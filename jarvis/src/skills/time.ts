import type { Skill } from './types';

export const timeSkill: Skill = {
  name: 'time',
  match: (input) => {
    const t = input.text.trim().toLowerCase();
    if (t === 'time' || t === 'now' || t === 'date') return { score: 0.9, intent: 'time.now' };
    if (t.includes('what time') || t.includes('current time'))
      return { score: 0.8, intent: 'time.now' };
    if (t.includes('date') || t.includes('time')) return { score: 0.4, intent: 'time.now' };
    return { score: 0 };
  },
  run: async (_input, ctx) => {
    return {
      intent: 'time.now',
      result: {
        iso: ctx.now.toISOString(),
        epochMs: ctx.now.getTime(),
      },
      actions: [],
    };
  },
};
