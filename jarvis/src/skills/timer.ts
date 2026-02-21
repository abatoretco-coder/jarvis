import type { Skill } from './types';

import { normalizeText } from '../lib/text';

function parseDurationSeconds(text: string): number | undefined {
  const m = normalizeText(text).match(
    /\b(\d+)\s*(s|sec|secs|seconde|secondes|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|heure|heures|hour|hours)\b/
  );
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = m[2];
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (unit.startsWith('h')) return n * 3600;
  if (unit.startsWith('heu')) return n * 3600;
  if (unit.startsWith('m')) return n * 60;
  return n;
}

export const timerSkill: Skill = {
  name: 'timer',
  match: (input) => {
    const t = normalizeText(input.text);
    if (t.startsWith('timer') || t.startsWith('minuteur')) return { score: 0.8, intent: 'timer.set' };
    if (t.includes('set a timer') || t.includes('set timer')) return { score: 0.7, intent: 'timer.set' };
    if (t.includes('mets un minuteur') || t.includes('met un minuteur') || t.includes('lance un minuteur'))
      return { score: 0.75, intent: 'timer.set' };
    if (t.includes('mets un timer') || t.includes('met un timer') || t.includes('lance un timer'))
      return { score: 0.7, intent: 'timer.set' };
    return { score: 0 };
  },
  run: async (input, ctx) => {
    const seconds = parseDurationSeconds(input.text);
    return {
      intent: 'timer.set',
      result: {
        message: 'Timer skill is a stub in v0.1 (no background scheduler yet).',
        requestedSeconds: seconds ?? null,
        plan: [
          { step: 'parse_duration', seconds: seconds ?? null },
          { step: 'schedule_timer', status: 'TODO' },
          { step: 'notify', status: 'TODO' },
        ],
        requestId: ctx.requestId,
      },
      actions: seconds
        ? [{ type: 'timer.requested', seconds, requestedAt: ctx.now.toISOString() }]
        : [],
    };
  },
};
