import type { Skill, SkillInput } from './types';

function parseKeyValueArgs(argString: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const parts = argString
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const raw = part.slice(eq + 1).trim();
    if (!key) continue;

    if (/^\d+$/.test(raw)) out[key] = Number(raw);
    else if (raw === 'true') out[key] = true;
    else if (raw === 'false') out[key] = false;
    else out[key] = raw;
  }

  return out;
}

function tryParseExplicitHaCommand(text: string):
  | {
      domain: string;
      service: string;
      payload: Record<string, unknown>;
    }
  | undefined {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith('ha:') && !lower.startsWith('ha ')) return undefined;

  const afterPrefix = trimmed.startsWith('ha:') ? trimmed.slice(3).trim() : trimmed.slice(2).trim();
  const [first, ...rest] = afterPrefix.split(' ');
  if (!first) return undefined;
  const dot = first.indexOf('.');
  if (dot === -1) return undefined;

  const domain = first.slice(0, dot).trim();
  const service = first.slice(dot + 1).trim();
  if (!domain || !service) return undefined;

  const payload = parseKeyValueArgs(rest.join(' '));
  const entityId = payload.entity_id;
  if (typeof entityId !== 'string' || entityId.length === 0) {
    return undefined;
  }

  return { domain, service, payload };
}

export const homeAssistantSkill: Skill = {
  name: 'home_assistant',
  match: (input: SkillInput) => {
    const parsed = tryParseExplicitHaCommand(input.text);
    if (parsed) return { score: 0.95, intent: `ha.${parsed.domain}.${parsed.service}` };

    const t = input.text.toLowerCase();
    if (t.includes('home assistant') || t.startsWith('ha'))
      return { score: 0.2, intent: 'ha.unknown' };
    return { score: 0 };
  },
  run: async (input, ctx) => {
    const parsed = tryParseExplicitHaCommand(input.text);
    if (!parsed) {
      return {
        intent: 'ha.unknown',
        result: {
          message: 'Home Assistant skill requires explicit format in v0.1.',
          format: 'ha: <domain>.<service> entity_id=<entity_id> key=value ...',
          example: 'ha: light.turn_on entity_id=light.kitchen brightness_pct=40',
        },
        actions: [],
      };
    }

    const { entity_id: entityId, ...serviceData } = parsed.payload;
    const haResp = await ctx.ha.callService({
      domain: parsed.domain,
      service: parsed.service,
      serviceData,
      target: { entity_id: entityId },
    });

    return {
      intent: `ha.${parsed.domain}.${parsed.service}`,
      result: {
        haStatus: haResp.status,
        haData: haResp.data,
      },
      actions: [
        {
          type: 'home_assistant.service_call',
          domain: parsed.domain,
          service: parsed.service,
          target: { entity_id: entityId },
          serviceData,
        },
      ],
    };
  },
};
