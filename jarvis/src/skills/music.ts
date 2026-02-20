import type { Skill } from './types';

export const musicSkill: Skill = {
  name: 'music',
  match: (input) => {
    const t = input.text.trim().toLowerCase();
    if (t.startsWith('play ')) return { score: 0.7, intent: 'music.play' };
    if (t.includes('music')) return { score: 0.5, intent: 'music.plan' };
    return { score: 0 };
  },
  run: async (input, ctx) => {
    const query = input.text.replace(/^play\s+/i, '').trim();

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
