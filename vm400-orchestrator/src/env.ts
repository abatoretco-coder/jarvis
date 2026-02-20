import { z } from 'zod';

const numberFromEnv = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().regex(/^\d+$/, 'must be an integer'))
  .transform((v) => Number(v));

const envSchema = z.object({
  PORT: numberFromEnv.default('8090'),
  LOG_LEVEL: z.string().default('info'),
  BODY_LIMIT_BYTES: numberFromEnv.default('1048576'),

  JARVIS_BASE_URL: z.string().url(),
  JARVIS_API_KEY: z.string().optional(),

  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REDIRECT_URI: z.string().optional(),
  GMAIL_REFRESH_TOKEN: z.string().optional(),
  GMAIL_USER_EMAIL: z.string().email().optional(),

  INBOX_STORE_PATH: z.string().default('/app/data/inbox.ndjson'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(rawEnv: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${message}`);
  }
  return parsed.data;
}
