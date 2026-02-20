import { describe, expect, it } from 'vitest';

import type { Env } from './config/env';
import { buildServer } from './server';
import { pingSkill } from './skills/ping';

const env = {
  PORT: 8080,
  LOG_LEVEL: 'silent',
  BODY_LIMIT_BYTES: 1024 * 1024,
  ALLOW_CORS: false,
  CORS_ORIGIN: undefined,
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
});
