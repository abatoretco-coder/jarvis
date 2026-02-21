import type { Skill } from './types';

import { normalizeText } from '../lib/text';

export const musicSkill: Skill = {
  name: 'music',
  match: (input) => {
    const t = normalizeText(input.text);
    if (t.startsWith('play ')) return { score: 0.7, intent: 'music.play' };
    if (t.startsWith('joue ') || t.startsWith('lance ') || t.startsWith('mets '))
      return { score: 0.65, intent: 'music.play' };
    if (t.includes('musique') || t.includes('music')) return { score: 0.5, intent: 'music.plan' };
    return { score: 0 };
  },
  run: async (input, ctx) => {
    const query = input.text
      .replace(/^play\s+/i, '')
      .replace(/^joue\s+/i, '')
      .replace(/^lance\s+/i, '')
      .replace(/^mets\s+/i, '')
      .trim();

    return {
      intent: 'music.plan',
      result: {
        message: 'Music skill is a stub in v0.1 (no Spotify integration yet).',
        requestId: ctx.requestId,
        plan: [
          { step: 'parse_query', query: query || '(empty)' },
          { step: 'select_provider', provider: 'TODO' },
          { step: 'search', provider: 'TODO', query: query || '(empty)' },
          { step: 'playback', device: 'TODO' },
        ],
      },
      actions: query ? [{ type: 'music.play_request', query }] : [],
    };
  },
};
