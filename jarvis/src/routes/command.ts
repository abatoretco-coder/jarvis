import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { executeActions } from '../actions/execute';
import { llmResultToRouted, maybeHandleOpenAiFallback } from '../orchestrator/openaiFallback';
import { routeAndRun } from '../skills/router';
import type { Skill } from '../skills/types';

const commandBodySchema = z.object({
  text: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  options: z
    .object({
      execute: z.boolean().optional(),
    })
    .optional(),
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
        execute: parsed.data.options?.execute ?? app.env.EXECUTE_ACTIONS,
        env: {
          haEntityAliases: app.env.HA_ENTITY_ALIASES_JSON
            ? (JSON.parse(app.env.HA_ENTITY_ALIASES_JSON) as Record<string, string>)
            : undefined,
        },
        ha: {
          callService: app.ha.callService.bind(app.ha),
        },
      });

      const finalRouted =
        routed.skill !== 'fallback'
          ? routed
          : await (async () => {
              try {
                const llm = await maybeHandleOpenAiFallback(parsed.data, {
                  requestId: req.id,
                  now: new Date(),
                  execute: parsed.data.options?.execute ?? app.env.EXECUTE_ACTIONS,
                  env: {
                    haEntityAliases: app.env.HA_ENTITY_ALIASES_JSON
                      ? (JSON.parse(app.env.HA_ENTITY_ALIASES_JSON) as Record<string, string>)
                      : undefined,
                  },
                  ha: {
                    callService: app.ha.callService.bind(app.ha),
                  },
                }, app.env);

                if (!llm.handled || !llm.directive) return routed;

                return await llmResultToRouted(llm.directive, parsed.data, {
                  requestId: req.id,
                  now: new Date(),
                  execute: parsed.data.options?.execute ?? app.env.EXECUTE_ACTIONS,
                  env: {
                    haEntityAliases: app.env.HA_ENTITY_ALIASES_JSON
                      ? (JSON.parse(app.env.HA_ENTITY_ALIASES_JSON) as Record<string, string>)
                      : undefined,
                  },
                  ha: {
                    callService: app.ha.callService.bind(app.ha),
                  },
                }, skills, routeAndRun);
              } catch (err) {
                req.log.warn({ err }, 'openai_fallback_failed');
                return routed;
              }
            })();

      const execute = parsed.data.options?.execute ?? app.env.EXECUTE_ACTIONS;
      const executedActions = execute
        ? await executeActions(finalRouted.actions, { ha: app.ha })
        : undefined;

      return reply.code(200).send({
        requestId: req.id,
        intent: finalRouted.intent,
        skill: finalRouted.skill,
        result: finalRouted.result,
        actions: finalRouted.actions,
        executedActions,
        mode: execute ? 'execute' : 'plan',
      });
    });
  };
}
