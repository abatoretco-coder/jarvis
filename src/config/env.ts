import { z } from 'zod';

const booleanFromEnv = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.enum(['true', 'false']))
  .transform((v) => v === 'true');

const numberFromEnv = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().regex(/^\d+$/, 'must be an integer'))
  .transform((v) => Number(v));

const envSchema = z.object({
  PORT: numberFromEnv.default('8080'),
  LOG_LEVEL: z.string().default('info'),
  BODY_LIMIT_BYTES: numberFromEnv.default('1048576'),
  ALLOW_CORS: booleanFromEnv.default('false'),
  CORS_ORIGIN: z.string().optional(),
  HA_BASE_URL: z.string().url(),
  HA_TOKEN: z.string().min(1),
  HA_TIMEOUT_MS: numberFromEnv.default('10000'),
  BUILD_SHA: z.string().optional(),
  BUILD_TIME: z.string().optional(),
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

export function envForLogging(env: Env) {
  const { HA_TOKEN: _haToken, ...rest } = env;
  return rest;
}
