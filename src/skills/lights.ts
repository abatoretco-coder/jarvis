import type { Skill } from './types';

function parsePercent(text: string): number | undefined {
  const m = text.match(/\b(\d{1,3})\s*%\b/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  if (n < 0 || n > 100) return undefined;
  return n;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAlias(text: string): string | undefined {
  const t = normalize(text);
  const m1 = t.match(/\b(turn on|turn off)\b\s+(.+?)\s+\b(light|lights)\b/);
  if (m1) return `${m1[2]} light`.trim();
  const m2 = t.match(/\b(allume|eteins|éteins)\b\s+(.+?)\s+\b(lumiere|lumière|lampes?|lumières)\b/);
  if (m2) return `${m2[2]} light`.trim();
  return undefined;
}

function isTurnOn(text: string): boolean | undefined {
  const t = normalize(text);
  if (t.includes('turn on') || t.includes('allume')) return true;
  if (t.includes('turn off') || t.includes('eteins') || t.includes('éteins')) return false;
  return undefined;
}

export const lightsSkill: Skill = {
  name: 'lights',
  match: (input) => {
    const t = normalize(input.text);
    if (t.includes('light') || t.includes('lumiere') || t.includes('lumière')) {
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
    const entityId = alias ? (map[alias] ?? map[normalize(alias)]) : undefined;
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
