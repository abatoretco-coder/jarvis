import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';

import type { Env } from './config/env';
import { buildServer } from './server';
import { homeAssistantSkill } from './skills/homeAssistant';
import { inboxSkill } from './skills/inbox';
import { lightsSkill } from './skills/lights';
import { musicSkill } from './skills/music';
import { pingSkill } from './skills/ping';
import { robotSkill } from './skills/robot';
import { timeSkill } from './skills/time';
import { timerSkill } from './skills/timer';

const env = {
  PORT: 8080,
  LOG_LEVEL: 'silent',
  BODY_LIMIT_BYTES: 1024 * 1024,
  ALLOW_CORS: false,
  CORS_ORIGIN: undefined,
  REQUIRE_API_KEY: false,
  API_KEY: undefined,
  EXECUTE_ACTIONS: false,
  HA_BASE_URL: 'http://home-assistant:8123',
  HA_TOKEN: 'test-token',
  HA_TIMEOUT_MS: 1000,
  HA_ENTITY_ALIASES_JSON: undefined,

  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: 'gpt-5-mini',
  OPENAI_BASE_URL: undefined,
  OPENAI_TIMEOUT_MS: 1000,

  MEMORY_DIR: path.join(os.tmpdir(), 'jarvis-test-memory'),
  MEMORY_TTL_HOURS: 24,
  MEMORY_MAX_MESSAGES: 40,
  BUILD_SHA: undefined,
  BUILD_TIME: undefined,
} satisfies Env;

describe('server', () => {
  it('GET /health returns ok', async () => {
    const app = await buildServer(env, [pingSkill]);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBeTypeOf('string');
    await app.close();
  });

  it('POST /v1/command routes ping', async () => {
    const app = await buildServer(env, [pingSkill]);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/command',
      payload: { text: 'ping' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skill).toBe('ping');
    expect(body.intent).toBe('ping');
    expect(body.requestId).toBeTypeOf('string');
    expect(body.mode).toBe('plan');
    await app.close();
  });

  it('POST /v1/command can execute HA actions when enabled', async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    globalThis.fetch = mockFetch;

    const app = await buildServer({ ...env, EXECUTE_ACTIONS: true }, [homeAssistantSkill]);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/command',
      payload: { text: 'ha: light.turn_on entity_id=light.kitchen' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.mode).toBe('execute');
    expect(body.actions.length).toBe(1);
    expect(body.executedActions.length).toBe(1);
    expect(body.executedActions[0].status).toBe('executed');
    await app.close();

    globalThis.fetch = originalFetch;
  });

  it('POST /v1/command routes time', async () => {
    const app = await buildServer(env, [timeSkill]);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/command',
      payload: { text: 'time' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skill).toBe('time');
    expect(body.intent).toBe('time.now');
    expect(body.result.iso).toBeTypeOf('string');
    await app.close();
  });

  it('POST /v1/command routes time (FR)', async () => {
    const app = await buildServer(env, [timeSkill]);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/command',
      payload: { text: 'Quelle heure est-il ?' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skill).toBe('time');
    expect(body.intent).toBe('time.now');
    await app.close();
  });

  it('POST /v1/command routes inbox (email)', async () => {
    const app = await buildServer(env, [inboxSkill]);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/command',
      payload: { text: 'read my emails', options: { execute: false } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skill).toBe('inbox');
    expect(body.actions.length).toBe(1);
    expect(body.actions[0].type).toBe('connector.request');
    expect(body.actions[0].connector).toBe('email');
    expect(body.mode).toBe('plan');
    await app.close();
  });

  it('POST /v1/command routes inbox summarize (FR)', async () => {
    const app = await buildServer(env, [inboxSkill]);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/command',
      payload: { text: 'Résume mes messages WhatsApp', options: { execute: false } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skill).toBe('inbox');
    expect(String(body.intent)).toContain('whatsapp');
    expect(String(body.intent)).toContain('summarize');
    expect(body.actions.length).toBe(1);
    expect(body.actions[0].type).toBe('connector.request');
    expect(body.actions[0].connector).toBe('whatsapp');
    expect(body.actions[0].operation).toBe('summarize');
    await app.close();
  });

  it('POST /v1/command routes timer (FR)', async () => {
    const app = await buildServer(env, [timerSkill]);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/command',
      payload: { text: 'Mets un minuteur 5 minutes' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skill).toBe('timer');
    expect(body.intent).toBe('timer.set');
    expect(body.actions.length).toBe(1);
    expect(body.actions[0].type).toBe('timer.requested');
    expect(body.actions[0].seconds).toBe(5 * 60);
    await app.close();
  });

  it('POST /v1/command routes music (FR)', async () => {
    const app = await buildServer(env, [musicSkill]);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/command',
      payload: { text: 'Joue Daft Punk' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skill).toBe('music');
    expect(body.actions.length).toBe(1);
    expect(body.actions[0].type).toBe('music.play_request');
    expect(String(body.actions[0].query).toLowerCase()).toContain('daft');
    await app.close();
  });

  it('POST /v1/command routes robot (FR)', async () => {
    const app = await buildServer(env, [robotSkill]);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/command',
      payload: { text: "Démarre l'aspirateur" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skill).toBe('robot');
    expect(body.actions.length).toBe(1);
    expect(body.actions[0].type).toBe('robot.start');
    await app.close();
  });

  it('POST /v1/command routes lights (FR accents + brightness)', async () => {
    const app = await buildServer(
      {
        ...env,
        HA_ENTITY_ALIASES_JSON: JSON.stringify({
          'cuisine light': 'light.kitchen',
          'salon light': 'light.living_room',
        }),
      },
      [lightsSkill]
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/command',
      payload: { text: 'Allume la lumière cuisine à 40%' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skill).toBe('lights');
    expect(String(body.intent)).toContain('lights.on');
    expect(body.actions.length).toBe(1);
    expect(body.actions[0].type).toBe('home_assistant.service_call');
    expect(body.actions[0].domain).toBe('light');
    expect(body.actions[0].service).toBe('turn_on');
    expect(body.actions[0].target.entity_id).toBe('light.kitchen');
    expect(body.actions[0].serviceData.brightness_pct).toBe(40);
    await app.close();
  });

  it('POST /v1/command uses OpenAI fallback when no skill matches', async () => {
    const originalFetch = globalThis.fetch;

    const mockFetch: typeof fetch = async (_input, _init) => {
      // Minimal OpenAI chat.completions-like payload.
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ type: 'command', text: 'ping' }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    };

    globalThis.fetch = mockFetch;

    const app = await buildServer({ ...env, OPENAI_API_KEY: 'k' }, [pingSkill]);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/command',
      payload: { text: 'hello there' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skill).toBe('ping');
    expect(String(body.intent)).toContain('llm.rewrite');

    await app.close();
    globalThis.fetch = originalFetch;
  });

  it('POST /v1/command OpenAI fallback can rewrite to lights (FR)', async () => {
    const originalFetch = globalThis.fetch;

    const mockFetch: typeof fetch = async (_input, _init) => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  type: 'command',
                  text: 'allume la lumière cuisine 40%',
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    };

    globalThis.fetch = mockFetch;

    const app = await buildServer(
      {
        ...env,
        OPENAI_API_KEY: 'k',
        HA_ENTITY_ALIASES_JSON: JSON.stringify({ 'cuisine light': 'light.kitchen' }),
      },
      [lightsSkill]
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/command',
      payload: { text: 'Peux-tu faire ça stp ?' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skill).toBe('lights');
    expect(String(body.intent)).toContain('llm.rewrite');
    expect(body.actions.length).toBe(1);
    expect(body.actions[0].type).toBe('home_assistant.service_call');
    expect(body.actions[0].target.entity_id).toBe('light.kitchen');

    await app.close();
    globalThis.fetch = originalFetch;
  });

  it('API key: /health does not require key', async () => {
    const app = await buildServer({ ...env, REQUIRE_API_KEY: true, API_KEY: 'k' }, [pingSkill]);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('API key: /v1/command requires key when enabled', async () => {
    const app = await buildServer({ ...env, REQUIRE_API_KEY: true, API_KEY: 'k' }, [pingSkill]);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/command',
      payload: { text: 'ping' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('API key: /v1/command accepts key when enabled', async () => {
    const app = await buildServer({ ...env, REQUIRE_API_KEY: true, API_KEY: 'k' }, [pingSkill]);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/command',
      headers: { 'x-api-key': 'k' },
      payload: { text: 'ping' },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
