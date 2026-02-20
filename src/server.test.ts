import { describe, expect, it } from 'vitest';

import type { Env } from './config/env';
import { buildServer } from './server';
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
  HA_BASE_URL: 'http://home-assistant:8123',
  HA_TOKEN: 'test-token',
  HA_TIMEOUT_MS: 1000,
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
    await app.close();
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
