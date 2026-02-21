import { parseKeyValueArgs } from '../lib/parseArgs';
import { normalizeText } from '../lib/text';
import type { Skill } from './types';

function detectWhen(text: string): 'now' | 'today' | 'tomorrow' | 'week' {
  const t = normalizeText(text);
  if (t.includes('demain')) return 'tomorrow';
  if (t.includes('semaine') || t.includes('7 jours') || t.includes('sept jours')) return 'week';
  if (t.includes("aujourd'hui") || t.includes('aujourd hui') || t.includes('auj')) return 'today';
  return 'now';
}

function looksLikeWeatherQuestion(text: string): boolean {
  const t = normalizeText(text);
  if (t.includes('meteo')) return true;
  if (t.includes('prevision') || t.includes('previsions')) return true;
  if (t.includes('temperature')) return true;
  if (t.includes('pluie') || t.includes('pleut')) return true;
  if (t.includes('orage') || t.includes('neige') || t.includes('vent')) return true;
  // Avoid matching generic "temps" which is ambiguous in French.
  return false;
}

function parseExplicitEntityId(text: string): string | undefined {
  const raw = text.trim();
  const args = parseKeyValueArgs(raw);
  const v = args.entity ?? args.entity_id ?? args.weather ?? args.meteo;
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s) return undefined;
  return s;
}

export const weatherSkill: Skill = {
  name: 'weather',
  match: (input) => {
    if (!looksLikeWeatherQuestion(input.text)) return { score: 0 };
    return { score: 0.62, intent: `weather.${detectWhen(input.text)}` };
  },
  run: async (input) => {
    const when = detectWhen(input.text);
    const entityId = parseExplicitEntityId(input.text);

    return {
      intent: `weather.${when}`,
      result: {
        planned: true,
        when,
        entityId: entityId ?? null,
        message:
          entityId
            ? `OK, je récupère la météo via ${entityId}.`
            : "OK, je récupère la météo depuis Home Assistant.",
      },
      actions: [
        {
          type: 'weather.query',
          when,
          entityId,
        },
      ],
    };
  },
};
