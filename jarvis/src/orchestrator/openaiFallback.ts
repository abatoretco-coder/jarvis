import type { Env } from '../config/env';
import type { Skill, SkillInput, SkillRunContext } from '../skills/types';
import type { RoutedSkillResult } from '../skills/router';

import { MemoryStore } from './memoryStore';

type OpenAiDirective =
  | { type: 'chat'; text: string }
  | { type: 'command'; text: string };

function getConversationId(input: SkillInput, ctx: SkillRunContext): string {
  const c = input.context;
  const candidates = [
    typeof c?.conversationId === 'string' ? c.conversationId : undefined,
    typeof c?.sessionId === 'string' ? c.sessionId : undefined,
    typeof c?.deviceId === 'string' ? c.deviceId : undefined,
    typeof c?.userId === 'string' ? c.userId : undefined,
  ];
  return candidates.find((v) => typeof v === 'string' && v.trim()) ?? 'default';
}

function buildSystemPrompt(): string {
  return [
    'You are Jarvis, an intent router for a smart-home assistant.',
    'Your job: decide whether the user message is (A) a conversation response, or (B) a command that should be rewritten into Jarvis command syntax.',
    '',
    'Return ONLY valid JSON with shape:',
    '{"type":"chat"|"command","text":"..."}',
    '',
    'If the user is asking to control devices / home automation, prefer type="command".',
    'If the user is just chatting, asking questions, or needs an explanation, use type="chat".',
    '',
    'Supported command patterns (examples):',
    '- ping',
    '- time',
    '- todo: buy milk',
    '- timer 5 minutes (or: set a timer 5 minutes)',
    '- turn on kitchen light 40% (FR also: allume lumière cuisine 40%)',
    '- ha: <domain>.<service> entity_id=<entity_id> (ONLY if you know a valid target key like entity_id/area_id/device_id)',
    '- read my emails / read my sms / read my whatsapp / read my messenger',
    '- play music <query>',
    '',
    'Rules:',
    '- If you output type="command", keep it short and directly executable.',
    '- Never invent entity_id values; only use ha: when the user already gave a specific entity_id/area_id/device_id.',
    '- Otherwise prefer the natural command (lights/todo/timer/etc.).',
    '- Language: respond in the same language as the user (French if user speaks French).',
  ].join('\n');
}

async function openAiChatJson(env: Env, messages: { role: 'system' | 'user' | 'assistant'; content: string }[]) {
  const url = new URL('/v1/chat/completions', env.OPENAI_BASE_URL ?? 'https://api.openai.com');

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), env.OPENAI_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`OpenAI request failed: ${resp.status} ${resp.statusText} ${text}`);
    }

    const data = (await resp.json()) as any;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('OpenAI response missing message content');
    }
    return content;
  } finally {
    clearTimeout(t);
  }
}

function parseDirective(raw: string): OpenAiDirective {
  try {
    const parsed = JSON.parse(raw) as any;
    if (parsed?.type === 'command' && typeof parsed.text === 'string' && parsed.text.trim()) {
      return { type: 'command', text: parsed.text.trim() };
    }
    if (parsed?.type === 'chat' && typeof parsed.text === 'string' && parsed.text.trim()) {
      return { type: 'chat', text: parsed.text.trim() };
    }
  } catch {
    // fall through
  }

  // Fallback: treat raw as chat.
  return { type: 'chat', text: raw.trim() };
}

export async function maybeHandleOpenAiFallback(input: SkillInput, ctx: SkillRunContext, env: Env): Promise<{
  handled: boolean;
  directive?: OpenAiDirective;
  conversationId?: string;
}> {
  if (!env.OPENAI_API_KEY) return { handled: false };

  const conversationId = getConversationId(input, ctx);
  const store = new MemoryStore(env.MEMORY_DIR, env.MEMORY_TTL_HOURS, env.MEMORY_MAX_MESSAGES);
  const history = await store.loadRecent(conversationId, ctx.now);

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: buildSystemPrompt() },
  ];

  for (const m of history) {
    messages.push({ role: m.role, content: m.content });
  }

  messages.push({ role: 'user', content: input.text });

  const raw = await openAiChatJson(env, messages);
  const directive = parseDirective(raw);

  await store.append(conversationId, { ts: ctx.now.toISOString(), role: 'user', content: input.text }, ctx.now);
  await store.append(
    conversationId,
    { ts: ctx.now.toISOString(), role: 'assistant', content: directive.type === 'command' ? `CMD: ${directive.text}` : directive.text },
    ctx.now
  );

  return { handled: true, directive, conversationId };
}

export async function llmResultToRouted(
  directive: OpenAiDirective,
  input: SkillInput,
  ctx: SkillRunContext,
  skills: Skill[],
  route: (skills: Skill[], input: SkillInput, ctx: SkillRunContext) => Promise<RoutedSkillResult>
): Promise<RoutedSkillResult> {
  if (directive.type === 'chat') {
    return {
      skill: 'llm',
      intent: 'chat',
      result: { message: directive.text },
      actions: [],
    };
  }

  const rewritten: SkillInput = { ...input, text: directive.text };
  const routed = await route(skills, rewritten, ctx);

  if (routed.skill === 'fallback') {
    return {
      skill: 'llm',
      intent: 'chat',
      result: {
        message:
          "Je n'ai pas réussi à transformer ta demande en commande exécutable. Tu peux reformuler (ex: 'allume lumière cuisine 40%').",
        llmCommand: directive.text,
      },
      actions: [],
    };
  }

  return {
    ...routed,
    intent: `llm.rewrite.${routed.intent}`,
    result: {
      ...((typeof routed.result === 'object' && routed.result !== null && !Array.isArray(routed.result))
        ? (routed.result as Record<string, unknown>)
        : { value: routed.result }),
      llmCommand: directive.text,
    },
  };
}
