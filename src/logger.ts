import type { LoggerOptions, Logger } from 'winston';

import {
  createLogger as createWinstonLogger,
  format,
  transports,
} from 'winston';

import { env } from './env.ts';

const { combine, json, prettyPrint, colorize, errors } = format;
const { PRETTY_LOGS } = env;

export function createLogger(config?: LoggerOptions) {
  const formats = [json()];

  if (PRETTY_LOGS) {
    formats.push(errors({ stack: true }));
    formats.push(prettyPrint());
    formats.push(
      colorize({
        all: true,
        level: true,
      }),
    );
  }

  return createWinstonLogger({
    format: combine(...formats),
    transports: [new transports.Console()],
    ...config,
    level: 'debug',
  });
}

let logger: Logger;

export function getLogger(config?: LoggerOptions) {
  if (config && logger) {
    throw new Error(
      'Logger singleton already created; cannot set config (use `addXXXXX` methods on `getLogger()` result instead.',
    );
  }

  if (!logger) {
    logger = createLogger(config);
  }

  return logger;
}
