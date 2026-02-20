import { describe, expect, it } from 'vitest';

import type { Env } from './config/env';
import { buildServer } from './server';
import { homeAssistantSkill } from './skills/homeAssistant';
import { inboxSkill } from './skills/inbox';
import { pingSkill } from './skills/ping';
import { timeSkill } from './skills/time';

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
