import type { Skill } from './types';

export const pingSkill: Skill = {
  name: 'ping',
  match: (input) => {
    const t = input.text.trim().toLowerCase();
    if (t === 'ping' || t === '/ping') return { score: 1, intent: 'ping' };
    if (t.includes('ping')) return { score: 0.6, intent: 'ping' };
    return { score: 0 };
  },
  run: async (_input, ctx) => {
    return {
      intent: 'ping',
      result: { message: 'pong', requestId: ctx.requestId, timestamp: ctx.now.toISOString() },
      actions: [],
    };
  },
};
