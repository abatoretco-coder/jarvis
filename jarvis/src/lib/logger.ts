import type { LoggerOptions } from 'pino';

import type { Env } from '../config/env';

export function createLoggerOptions(env: Env): LoggerOptions {
  return {
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers.x-api-key',
        'request.headers.authorization',
        'request.headers.cookie',
        'request.headers.x-api-key',
      ],
      remove: true,
    },
  };
}
