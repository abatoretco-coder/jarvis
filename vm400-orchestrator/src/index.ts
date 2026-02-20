import Fastify from 'fastify';
import { z } from 'zod';

import { loadEnv } from './env';
import { readLatestEmails } from './gmail';
import { appendMessage, readLatest } from './inboxStore';
import { callJarvisPlan } from './jarvisClient';
import type { InboxMessage } from './types';

const ingestSchema = z.object({
  text: z.string().min(1),
});

const inboxIncomingSchema = z.object({
  source: z.enum(['sms', 'whatsapp', 'messenger']),
  from: z.string().optional(),
  text: z.string().min(1),
  timestamp: z.string().optional(),
});

async function main() {
  const env = loadEnv();
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        remove: true,
      },
    },
    bodyLimit: env.BODY_LIMIT_BYTES,
  });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  app.post('/v1/inbox/incoming', async (req, reply) => {
    const parsed = inboxIncomingSchema.safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    const msg: InboxMessage = {
      ...parsed.data,
      timestamp: parsed.data.timestamp ?? new Date().toISOString(),
    };
    await appendMessage(env.INBOX_STORE_PATH, msg);
    return reply.code(200).send({ status: 'stored' });
  });

  app.post('/v1/ingest', async (req, reply) => {
    const parsed = ingestSchema.safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });

    const jarvis = await callJarvisPlan(env, parsed.data.text);

    const outputs: Array<Record<string, unknown>> = [];

    for (const action of jarvis.actions) {
      if (action.type === 'connector.request' && action.connector === 'email') {
        const limit = typeof action.params?.limit === 'number' ? action.params.limit : 5;
        const emails = await readLatestEmails(env, limit);
        outputs.push({
          type: 'connector.result',
          connector: 'email',
          operation: action.operation,
          emails,
        });
        continue;
      }

      if (
        action.type === 'connector.request' &&
        (action.connector === 'sms' ||
          action.connector === 'whatsapp' ||
          action.connector === 'messenger')
      ) {
        const limit = typeof action.params?.limit === 'number' ? action.params.limit : 5;
        const msgs = await readLatest(env.INBOX_STORE_PATH, limit);
        outputs.push({
          type: 'connector.result',
          connector: action.connector,
          operation: action.operation,
          messages: msgs,
        });
        continue;
      }

      outputs.push({ type: 'connector.skipped', reason: 'unsupported_action', action });
    }

    return reply.code(200).send({
      jarvis,
      outputs,
      summary: {
        message: 'Executed VM400 connectors for supported actions. Use outputs for TTS/UI.',
      },
    });
  });

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
