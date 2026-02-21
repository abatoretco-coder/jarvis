import type { Skill } from './types';

import { normalizeText } from '../lib/text';

function parsePercent(text: string): number | undefined {
  const mPct = text.match(/\b(\d{1,3})\s*%/);
  const mWord = mPct ? undefined : text.match(/\b(\d{1,3})\s*(pourcent|pourcents)\b/i);
  const raw = mPct?.[1] ?? mWord?.[1];
  if (!raw) return undefined;

  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  if (n < 0 || n > 100) return undefined;
  return n;
}

function stripTrailingPercentPhrase(s: string): string {
  return s
    .replace(/\ba\s*\d{1,3}\s*(%|pourcent|pourcents)\b/gi, '')
    .replace(/\b\d{1,3}\s*(%|pourcent|pourcents)\b/gi, '')
    .replace(/\ba\s*\d{1,3}\b/gi, '')
    .replace(/\b\d{1,3}\b\s*$/gi, '')
    .replace(/\ba\b\s*$/gi, '')
    .trim();
}

function cleanAliasWords(s: string): string {
  // remove common FR articles/prepositions that don't belong in an alias key
  return s
    .replace(/\b(la|le|les|l|un|une|des|du|de|d)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAlias(text: string): string | undefined {
  const t = normalizeText(text);

  // EN: "turn on kitchen light"
  const m1 = t.match(/\b(turn on|turn off)\b\s+(.+?)\s+\b(light|lights)\b/);
  if (m1) return `${stripTrailingPercentPhrase(m1[2])} light`.trim();

  // FR common: "allume la lumière du salon" | "eteins lumiere cuisine"
  const m2 = t.match(
    /\b(allume|allumer|eteins|eteindre|coupe|active|desactive)\b\s+(?:la|le|les|l)?\s*(?:lumiere|lampe|lampes)\b\s+(?:de|du|des|d)?\s*(.+)$/
  );
  if (m2) {
    const raw = cleanAliasWords(stripTrailingPercentPhrase(m2[2]));
    if (raw) return `${raw} light`.trim();
  }

  // FR alternative order: "allume cuisine lumiere"
  const m3 = t.match(
    /\b(allume|allumer|eteins|eteindre|coupe|active|desactive)\b\s+(.+?)\s+\b(lumiere|lampe|lampes)\b/
  );
  if (m3) {
    const raw = cleanAliasWords(stripTrailingPercentPhrase(m3[2]));
    if (raw) return `${raw} light`.trim();
  }

  return undefined;
}

function isTurnOn(text: string): boolean | undefined {
  const t = normalizeText(text);

  // Explicit EN.
  if (t.includes('turn on')) return true;
  if (t.includes('turn off')) return false;

  // Explicit FR.
  if (t.includes('allume') || t.includes('allumer') || t.includes('active')) return true;
  if (t.includes('eteins') || t.includes('eteindre') || t.includes('coupe') || t.includes('desactive'))
    return false;

  // If user sets a brightness, assume ON.
  const brightness = parsePercent(text);
  if (brightness !== undefined && (t.includes('lumiere') || t.includes('lampe') || t.includes('light')))
    return true;

  return undefined;
}

export const lightsSkill: Skill = {
  name: 'lights',
  match: (input) => {
    const t = normalizeText(input.text);
    if (t.includes('light') || t.includes('lumiere') || t.includes('lampe')) {
      const onOff = isTurnOn(input.text);
      if (onOff !== undefined) return { score: 0.6, intent: onOff ? 'lights.on' : 'lights.off' };
      return { score: 0.2, intent: 'lights.unknown' };
    }
    return { score: 0 };
  },
  run: async (input, ctx) => {
    const onOff = isTurnOn(input.text);
    const alias = extractAlias(input.text);
    const map = ctx.env.haEntityAliases ?? {};
    const entityId = alias ? (map[alias] ?? map[normalizeText(alias)]) : undefined;
    const brightness = parsePercent(input.text);

    if (onOff === undefined || !entityId) {
      return {
        intent: 'lights.unknown',
        result: {
          message: 'Lights skill needs a known alias -> entity_id mapping.',
          requiredEnv: 'HA_ENTITY_ALIASES_JSON',
          exampleEnv: '{"kitchen light":"light.kitchen"}',
          exampleCommand: 'turn on kitchen light 40%',
        },
        actions: [],
      };
    }

    const domain = 'light';
    const service = onOff ? 'turn_on' : 'turn_off';
    const serviceData: Record<string, unknown> = {};
    if (onOff && brightness !== undefined) serviceData.brightness_pct = brightness;

    return {
      intent: onOff ? 'lights.on' : 'lights.off',
      result: {
        planned: true,
        entityId,
        service: `${domain}.${service}`,
        brightnessPct: brightness ?? null,
      },
      actions: [
        {
          type: 'home_assistant.service_call',
          domain,
          service,
          target: { entity_id: entityId },
          serviceData: Object.keys(serviceData).length ? serviceData : undefined,
        },
      ],
    };
  },
};
