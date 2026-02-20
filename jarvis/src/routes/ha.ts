import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const haServiceBodySchema = z.object({
  domain: z.string().min(1),
  service: z.string().min(1),
  serviceData: z.record(z.unknown()).optional(),
  target: z.record(z.unknown()).optional(),
});

export const haRoutes: FastifyPluginAsync = async (app) => {
  app.post('/v1/ha/service', async (req, reply) => {
    const parsed = haServiceBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_body',
        issues: parsed.error.issues,
      });
    }

    try {
      const r = await app.ha.callService(parsed.data);
      return reply.code(200).send({
        requestId: req.id,
        status: r.status,
        data: r.data,
      });
    } catch (err) {
      const e = err as Error;
      req.log.warn({ err: { name: e.name, message: e.message } }, 'home_assistant_call_failed');
      return reply.code(502).send({
        requestId: req.id,
        error: 'home_assistant_call_failed',
        message: e.message,
      });
    }
  });
};
