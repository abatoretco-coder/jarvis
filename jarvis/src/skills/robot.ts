import type { Skill } from './types';

import { normalizeText } from '../lib/text';
import { PendingStore } from '../orchestrator/pendingStore';

export const robotSkill: Skill = {
  name: 'robot',
  match: (input) => {
    const t = normalizeText(input.text);
    if (t.startsWith('robot:')) return { score: 0.8, intent: 'robot.start' };
    if (
      t.includes('robot') ||
      t.includes('aspirateur') ||
      t.includes('vacuum') ||
      t.includes('nettoie') ||
      t.includes('demarre') ||
      t.includes('lance')
    )
      return { score: 0.4, intent: 'robot.plan' };
    return { score: 0 };
  },
  run: async (input, ctx) => {
    const t = normalizeText(input.text);
    const robot = t.includes('vacuum') || t.includes('aspirateur') ? 'vacuum' : 'robot';

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

    const baseDir = ctx.env.memoryDir?.replace(/[\\/]+$/, '');
    const store = baseDir ? new PendingStore(`${baseDir}/pending`, 2 * 60 * 1000) : undefined;

    // Explicit commands bypass confirmation.
    if (t.startsWith('robot:')) {
      if (store) await store.clear(conversationId);
      return {
        intent: 'robot.start',
        result: {
          message: 'OK.',
          requestId: ctx.requestId,
        },
        actions: [{ type: 'robot.start', robot, mode: 'auto' }],
      };
    }

    // Natural language: ask for confirmation (safer default).
    if (store) {
      await store.set(conversationId, { type: 'robot.start', robot, mode: 'auto' }, ctx.now);
    }

    return {
      intent: 'robot.plan',
      result: {
        message: "Je lance l'aspirateur ? Réponds 'oui' ou 'non'.",
        requestId: ctx.requestId,
      },
      actions: [],
    };
  },
};
