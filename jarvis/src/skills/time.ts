import type { Skill } from './types';

import { normalizeText } from '../lib/text';

export const timeSkill: Skill = {
  name: 'time',
  match: (input) => {
    const t = normalizeText(input.text);
    if (t === 'time' || t === 'now' || t === 'date') return { score: 0.9, intent: 'time.now' };
    if (t.includes('what time') || t.includes('current time'))
      return { score: 0.8, intent: 'time.now' };
    if (
      t.includes('quelle heure') ||
      t.includes("c'est quoi l'heure") ||
      t.includes("c est quoi l heure") ||
      t.includes("donne moi l'heure") ||
      t.includes('donne moi l heure') ||
      t.includes('il est quelle heure')
    )
      return { score: 0.85, intent: 'time.now' };

    if (t.includes('quelle date') || t.includes('on est quel jour') || t.includes('date'))
      return { score: 0.7, intent: 'time.now' };

    if (t.includes('date') || t.includes('time') || t.includes('heure')) return { score: 0.4, intent: 'time.now' };
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
