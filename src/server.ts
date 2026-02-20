import { randomUUID } from 'node:crypto';

import cors from '@fastify/cors';
import Fastify from 'fastify';

import { type Env, envForLogging } from './config/env';
import { HomeAssistantClient } from './lib/haClient';
import { createLoggerOptions } from './lib/logger';
import { commandRoutes } from './routes/command';
import { haRoutes } from './routes/ha';
import { healthRoutes } from './routes/health';
import type { Skill } from './skills/types';

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    ha: HomeAssistantClient;
  }
}

export async function buildServer(env: Env, skills: Skill[]) {
  const app = Fastify({
    logger: createLoggerOptions(env),
    bodyLimit: env.BODY_LIMIT_BYTES,
    genReqId: (req) => {
      const header = req.headers['x-request-id'];
      if (typeof header === 'string' && header.trim()) return header;
      return randomUUID();
    },
  });

  app.decorate('env', env);
  app.decorate('ha', new HomeAssistantClient(env));

  if (env.ALLOW_CORS) {
    await app.register(cors, {
      origin: env.CORS_ORIGIN ?? '*',
    });
  }

  app.addHook('onRequest', async (req) => {
    req.log = req.log.child({ requestId: req.id });
  });

  app.get('/', async (_req, reply) => {
    return reply.code(200).send({
      name: 'jarvis',
      status: 'running',
    });
  });

  await app.register(healthRoutes);
  await app.register(commandRoutes(skills));
  await app.register(haRoutes);

  app.log.info({ env: envForLogging(env) }, 'jarvis_startup_config');
  return app;
}
