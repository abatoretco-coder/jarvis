import type { Env } from '../config/env';
import type { Skill, SkillInput, SkillRunContext } from '../skills/types';
import type { RoutedSkillResult } from '../skills/router';

import { z } from 'zod';

import { MemoryStore } from './memoryStore';

type OpenAiDirective =
  | { type: 'chat'; text: string }
  | { type: 'command'; text: string }
  | {
      type: 'actions';
      intent: string;
      message?: string;
      actions: import('../actions/types').JarvisAction[];
    };

type SelectServiceDirective = {
  type: 'select_service';
  domain: string;
  service: string;
  reason?: string;
};

type AnyDirective = OpenAiDirective | SelectServiceDirective;

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('home_assistant.service_call'), domain: z.string().min(1), service: z.string().min(1), target: z.record(z.unknown()).optional(), serviceData: z.record(z.unknown()).optional() }),
  z.object({ type: z.literal('todo.add_task'), title: z.string().min(1), list: z.string().min(1).optional(), dueAt: z.string().min(1).optional(), remindAt: z.string().min(1).optional() }),
  z.object({ type: z.literal('music.play_request'), query: z.string().min(1) }),
  z.object({ type: z.literal('plex.play_request'), query: z.string().min(1) }),
  z.object({ type: z.literal('robot.start'), robot: z.string().min(1), mode: z.string().min(1).optional() }),
  z.object({ type: z.literal('timer.requested'), seconds: z.number().int().positive(), requestedAt: z.string().min(1) }),
  z.object({ type: z.literal('weather.query'), entityId: z.string().min(1).optional(), when: z.enum(['now', 'today', 'tomorrow', 'week']) }),
  z.object({
    type: z.literal('connector.request'),
    connector: z.enum(['email', 'sms', 'whatsapp', 'messenger', 'todo']),
    operation: z.enum(['read_latest', 'summarize', 'search', 'list', 'create']),
    params: z.record(z.unknown()).optional(),
  }),
]);

const directiveSchema = z.union([
  z.object({ type: z.literal('chat'), text: z.string().min(1) }),
  z.object({ type: z.literal('command'), text: z.string().min(1) }),
  z.object({
    type: z.literal('actions'),
    intent: z.string().min(1),
    message: z.string().min(1).optional(),
    actions: z.array(actionSchema).default([]),
  }),
  z.object({
    type: z.literal('select_service'),
    domain: z.string().min(1),
    service: z.string().min(1),
    reason: z.string().min(1).optional(),
  }),
]);

type HaServiceEntry = {
  domain: string;
  services: Record<
    string,
    {
      name?: string;
      description?: string;
      fields?: Record<string, unknown>;
      target?: Record<string, unknown>;
    }
  >;
};

let haServicesCache:
  | { fetchedAtMs: number; data: HaServiceEntry[] }
  | undefined;

function formatHaServicesIndex(data: HaServiceEntry[]): string {
  // Compact representation: one line per domain.
  const lines: string[] = [];
  for (const d of data) {
    const services = Object.keys(d.services ?? {}).sort();
    if (!services.length) continue;
    lines.push(`${d.domain}: ${services.join(', ')}`);
  }
  return lines.join('\n');
}

function pickServiceSchema(data: HaServiceEntry[], domain: string, service: string) {
  const d = data.find((x) => x.domain === domain);
  const s = d?.services?.[service];
  if (!d || !s) return undefined;
  return {
    domain,
    service,
    name: s.name,
    description: s.description,
    target: s.target,
    fields: s.fields,
  };
}

async function getHaServices(ctx: SkillRunContext, now: Date): Promise<HaServiceEntry[] | undefined> {
  if (!ctx.ha.getServices) return undefined;
  const ttlMs = 60_000;
  if (haServicesCache && now.getTime() - haServicesCache.fetchedAtMs < ttlMs) return haServicesCache.data;

  const resp = await ctx.ha.getServices();
  if (resp.status < 200 || resp.status >= 300) return undefined;

  const raw = resp.data;
  if (!Array.isArray(raw)) return undefined;

  const parsed: HaServiceEntry[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const domain = (item as any).domain;
    const services = (item as any).services;
    if (typeof domain !== 'string' || !domain.trim()) continue;
    if (typeof services !== 'object' || services === null || Array.isArray(services)) continue;
    parsed.push({ domain, services: services as any });
  }

  haServicesCache = { fetchedAtMs: now.getTime(), data: parsed };
  return parsed;
}

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
    'You are Jarvis, an intent router for a smart-home assistant (FR/EN).',
    'Your job: decide whether the user message is (A) conversation (answer normally), or (B) a command that maps to ONE OR MORE actions from the catalog below (preferred), or (C) a command that should be rewritten into Jarvis command syntax.',
    '',
    'Return ONLY valid JSON matching ONE of these shapes:',
    '1) {"type":"actions","intent":"...","message":"...","actions":[...]}',
    '2) {"type":"command","text":"..."}',
    '3) {"type":"chat","text":"..."}',
    '',
    'If the user is asking to control devices / home automation, prefer type="actions" when possible.',
    'If the user is chatting, asking questions, or needs an explanation, use type="chat".',
    'If none of the catalog actions can be produced safely, use type="command" (rewrite to an existing Jarvis command), or type="chat" if it is not an actionable request.',
    '',
    'Action catalog (choose from these; do NOT invent other action types):',
    '- home_assistant.service_call {domain, service, target?, serviceData?}',
    '- lights should usually be expressed as a command (so the deterministic lights skill resolves aliases).',
    '- todo.add_task {title, list?, dueAt?, remindAt?}',
    '- timer.requested {seconds, requestedAt} (use requestedAt=now ISO)',
    '- music.play_request {query}',
    '- plex.play_request {query}',
    '- weather.query {when: now|today|tomorrow|week, entityId?}',
    '- robot.start {robot, mode?} (NOTE: robot is confirmation-gated later; keep it simple)',
    '- connector.request {connector: email|sms|whatsapp|messenger|todo, operation?, params?}',
    '',
    'Supported command patterns (examples). Prefer the simplest existing pattern:',
    '- ping',
    '- time (FR: quelle heure est-il ? -> time)',
    '- todo: buy milk (FR: ajoute une tâche appeler le dentiste -> todo: appeler le dentiste)',
    '- todo: call dentist due=2026-02-23T09:00 remind=2026-02-23T08:50 (FR: ajoute une tâche appeler le dentiste demain 9h avec rappel 8h50)',
    '- liste mes tâches -> (command) todo list',
    '- timer 5 minutes (FR: mets un minuteur 5 minutes -> timer 5 minutes)',
    '- turn on kitchen light 40% (FR: allume la lumière cuisine 40%)',
    '- turn off kitchen light (FR: éteins la lumière cuisine)',
    '- read my emails (FR: lis mes emails)',
    '- summarize my whatsapp (FR: résume mes messages whatsapp)',
    '- play <query> (FR: joue daft punk -> play daft punk)',
    '- plex <query> (FR: mets plex the office -> plex the office)',
    '- robot: start (FR: lance l\'aspirateur -> robot: start)',
    '- ha: <domain>.<service> entity_id=<entity_id> key=value ...',
    '',
    'Rules:',
    '- If you output type="actions", actions must be directly usable without guessing missing IDs.',
    '- If you output type="command", keep it short and directly executable.',
    '- Never invent entity_id/area_id/device_id values; only use ha: when the user already gave a specific entity_id/area_id/device_id.',
    '- If the user mentions a device by name but provides no explicit target id, avoid ha:. Prefer skill commands like lights/todo/timer/inbox/music/robot.',
    '- Do not add extra words around the command (no quotes, no explanations).',
    '- Language: match the user language in chat mode; command mode uses Jarvis command syntax.',
    '- If the request is unsafe/ambiguous (e.g., could start a robot in the wrong area), prefer asking a clarification in chat mode.',
    '- For Home Assistant: you may output home_assistant.service_call only if the user provided an explicit target id (entity_id/device_id/area_id) OR if the service clearly needs no target. If unsure, ask a clarification (chat).',
    '- If you need the exact schema/fields for a Home Assistant service, respond with type="select_service" and the chosen {domain,service}.',
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

function parseDirective(raw: string): AnyDirective {
  const parsed = (() => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  })();

  const r = directiveSchema.safeParse(parsed);
  if (r.success) {
    if (r.data.type === 'command') return { type: 'command', text: r.data.text.trim() };
    if (r.data.type === 'chat') return { type: 'chat', text: r.data.text.trim() };
    if (r.data.type === 'select_service') {
      return {
        type: 'select_service',
        domain: r.data.domain.trim(),
        service: r.data.service.trim(),
        reason: r.data.reason?.trim(),
      };
    }
    return {
      type: 'actions',
      intent: r.data.intent.trim(),
      message: r.data.message?.trim(),
      actions: r.data.actions,
    };
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

  const haServices = await getHaServices(ctx, ctx.now);
  if (haServices?.length) {
    const index = formatHaServicesIndex(haServices);
    messages.push({
      role: 'user',
      content: [
        input.text,
        '',
        'Home Assistant services index (domain: services...):',
        index,
        '',
        'If you need details for one specific service, return type="select_service".',
      ].join('\n'),
    });
  } else {
    messages.push({ role: 'user', content: input.text });
  }

  const raw = await openAiChatJson(env, messages);
  const directive1 = parseDirective(raw);

  const directive: OpenAiDirective = await (async () => {
    if (directive1.type !== 'select_service') return directive1;
    if (!haServices?.length) {
      return { type: 'chat', text: "Je peux essayer, mais je n'ai pas accès au catalogue Home Assistant. Peux-tu préciser ?" };
    }

    const schema = pickServiceSchema(haServices, directive1.domain, directive1.service);
    if (!schema) {
      return { type: 'chat', text: `Je ne trouve pas le service ${directive1.domain}.${directive1.service} dans Home Assistant.` };
    }

    const followup: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: buildSystemPrompt() },
      ...history.map((m) => ({ role: m.role, content: m.content } as const)),
      {
        role: 'user',
        content: [
          input.text,
          '',
          'Selected Home Assistant service schema (JSON):',
          JSON.stringify(schema),
          '',
          'Now respond with type="actions" (preferred), or type="command", or type="chat" if not actionable.',
        ].join('\n'),
      },
    ];

    const raw2 = await openAiChatJson(env, followup);
    const d2 = parseDirective(raw2);
    if (d2.type === 'select_service') {
      return { type: 'chat', text: "Je ne peux pas enchaîner plus loin sans plus de détails (cible/paramètres)." };
    }
    return d2;
  })();

  await store.append(conversationId, { ts: ctx.now.toISOString(), role: 'user', content: input.text }, ctx.now);
  await store.append(
    conversationId,
    {
      ts: ctx.now.toISOString(),
      role: 'assistant',
      content:
        directive.type === 'command'
          ? `CMD: ${directive.text}`
          : directive.type === 'actions'
            ? `ACT: ${JSON.stringify({ intent: directive.intent, actions: directive.actions })}`
            : directive.text,
    },
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

  if (directive.type === 'actions') {
    return {
      skill: 'llm',
      intent: `llm.actions.${directive.intent}`,
      result: {
        message: directive.message ?? 'OK.',
      },
      actions: directive.actions,
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
