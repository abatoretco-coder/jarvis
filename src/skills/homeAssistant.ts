import { parseKeyValueArgs } from '../lib/parseArgs';
import type { Skill, SkillInput } from './types';

const supportedTargetKeys = new Set(['entity_id', 'area_id', 'device_id', 'floor_id', 'label_id']);

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

  const hasAnyTarget = Object.keys(payload).some((k) => supportedTargetKeys.has(k));
  if (!hasAnyTarget) return undefined;

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
          format: 'ha: <domain>.<service> entity_id=<id>|area_id=<id>|device_id=<id> key=value ...',
          example: 'ha: light.turn_on entity_id=light.kitchen brightness_pct=40',
          quoting: 'Use quotes for spaces: name="Kitchen Light"',
        },
        actions: [],
      };
    }

    const target: Record<string, unknown> = {};
    const serviceData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed.payload)) {
      if (supportedTargetKeys.has(k)) target[k] = v;
      else serviceData[k] = v;
    }

    const haResp = await ctx.ha.callService({
      domain: parsed.domain,
      service: parsed.service,
      serviceData,
      target,
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
          target,
          serviceData,
        },
      ],
    };
  },
};
