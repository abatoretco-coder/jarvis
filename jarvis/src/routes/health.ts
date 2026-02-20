import type { FastifyPluginAsync } from 'fastify';

import { getPackageVersion } from '../lib/packageVersion';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_req, reply) => {
    const version = getPackageVersion();
    const build = {
      sha: process.env.BUILD_SHA || undefined,
      time: process.env.BUILD_TIME || undefined,
    };

    return reply.code(200).send({
      status: 'ok',
      version,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      build,
    });
  });
};
