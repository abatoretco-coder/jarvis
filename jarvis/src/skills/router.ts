import type { Skill, SkillInput, SkillRunContext } from './types';

import { PendingStore } from '../orchestrator/pendingStore';

import { normalizeText } from '../lib/text';

export type RoutedSkillResult = {
  skill: string;
  intent: string;
  result: unknown;
  actions: import('../actions/types').JarvisAction[];
};

export async function routeAndRun(
  skills: Skill[],
  input: SkillInput,
  ctx: SkillRunContext
): Promise<RoutedSkillResult> {
  const t0 = normalizeText(input.text);
  // Safety: keep confirmations strict to avoid accidental execution.
  const isYes = t0 === 'oui';
  const isNo = t0 === 'non' || t0 === 'annule' || t0 === 'stop';

  const c = input.context;
  const conversationId =
    (typeof c?.conversationId === 'string' && c.conversationId.trim())
      ? c.conversationId.trim()
      : (typeof (c as any)?.conversation_id === 'string' && String((c as any).conversation_id).trim())
        ? String((c as any).conversation_id).trim()
        : (typeof c?.sessionId === 'string' && c.sessionId.trim())
          ? c.sessionId.trim()
          : (typeof c?.deviceId === 'string' && c.deviceId.trim())
            ? c.deviceId.trim()
            : (typeof c?.userId === 'string' && c.userId.trim())
              ? c.userId.trim()
              : 'default';

  if ((isYes || isNo) && ctx.env.memoryDir) {
    const baseDir = ctx.env.memoryDir.replace(/[\\/]+$/, '');
    const store = new PendingStore(`${baseDir}/pending`, 2 * 60 * 1000);
    const pending = isYes ? await store.consume(conversationId, ctx.now) : await store.get(conversationId, ctx.now);
    if (pending) {
      // Only confirm/cancel actions we explicitly gate behind confirmation.
      if (pending.action.type !== 'robot.start') {
        if (isNo) await store.clear(conversationId);
        // Ignore and proceed with normal routing.
      } else {
      if (isNo) await store.clear(conversationId);
      return {
        skill: 'confirm',
        intent: pending.action.type === 'robot.start' ? (isYes ? 'robot.confirmed' : 'robot.cancelled') : (isYes ? 'confirm.yes' : 'confirm.no'),
        result: { message: isYes ? 'OK.' : "OK, j'annule." },
        actions: isYes ? [pending.action] : [],
      };
      }
    }
  }

  let best: { skill: Skill; score: number; intent: string } | undefined;

  for (const skill of skills) {
    const m = skill.match(input);
    const score = Number.isFinite(m.score) ? m.score : 0;
    if (!best || score > best.score) {
      best = {
        skill,
        score,
        intent: m.intent ?? skill.name,
      };
    }
  }

  if (!best || best.score <= 0) {
    return {
      skill: 'fallback',
      intent: 'unknown',
      result: {
        message: "Je n'ai pas reconnu cette commande.",
        hint: [
          'Exemples:',
          '- ping',
          '- time (ou: quelle heure est-il ?)',
          '- quelle météo ? (ou: météo demain | météo semaine | météo entity=weather.xxx)',
          '- todo: acheter du lait (ou: ajoute une tâche appeler le dentiste)',
          '- allume la lumière cuisine 40%',
          '- ha: <domain>.<service> entity_id=<id> key=value ...',
          '- lis mes emails / résume mes messages whatsapp',
          '- joue daft punk (ou: play music <query>)',
        ].join('\n'),
      },
      actions: [],
    };
  }

  const ran = await best.skill.run(input, ctx);
  return {
    skill: best.skill.name,
    intent: ran.intent,
    result: ran.result,
    actions: ran.actions,
  };
}
