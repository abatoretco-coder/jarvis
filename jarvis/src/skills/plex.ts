import type { Skill } from './types';

import { normalizeText } from '../lib/text';

function extractQuery(text: string): string {
  // Keep it very conservative: only trim obvious leading verbs + the word plex.
  return text
    .replace(/^\s*(mets|met|lance|joue|play)\s+/i, '')
    .replace(/\bplex\b\s*/i, '')
    .trim();
}

export const plexSkill: Skill = {
  name: 'plex',
  match: (input) => {
    const t = normalizeText(input.text);
    if (t.includes('plex')) return { score: 0.55, intent: 'plex.play_request' };
    return { score: 0 };
  },
  run: async (input, ctx) => {
    const query = extractQuery(input.text);
    if (!query) {
      return {
        intent: 'plex.ask',
        result: {
          message: "OK. Qu'est-ce que je dois lancer sur Plex ? Donne un lien Plex ou un titre.",
          requestId: ctx.requestId,
        },
        actions: [],
      };
    }

    return {
      intent: 'plex.play_request',
      result: { message: 'OK.', requestId: ctx.requestId, query },
      actions: [{ type: 'plex.play_request', query }],
    };
  },
};
