import type { LoggerOptions } from 'pino';

import type { Env } from '../config/env';

export function createLoggerOptions(env: Env): LoggerOptions {
  return {
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'request.headers.authorization',
        'request.headers.cookie',
      ],
      remove: true,
    },
  };
}
