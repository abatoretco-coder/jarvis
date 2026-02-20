import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { routeAndRun } from '../skills/router';
import type { Skill } from '../skills/types';

const commandBodySchema = z.object({
  text: z.string().min(1),
  context: z.record(z.unknown()).optional(),
});

export function commandRoutes(skills: Skill[]): FastifyPluginAsync {
  return async (app) => {
    app.post('/v1/command', async (req, reply) => {
      const parsed = commandBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_body',
          issues: parsed.error.issues,
        });
      }

      const routed = await routeAndRun(skills, parsed.data, {
        requestId: req.id,
        now: new Date(),
        ha: {
          callService: app.ha.callService.bind(app.ha),
        },
      });

      return reply.code(200).send({
        requestId: req.id,
        intent: routed.intent,
        skill: routed.skill,
        result: routed.result,
        actions: routed.actions,
      });
    });
  };
}
