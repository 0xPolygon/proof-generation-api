import type { LoggerOptions, Logger } from 'winston';

import * as Sentry from '@sentry/node';
import {
  createLogger as createWinstonLogger,
  format,
  transports,
} from 'winston';
import Transport from 'winston-transport';

import { env } from './env.ts';

const { combine, json, prettyPrint, colorize, errors } = format;
const { PRETTY_LOGS } = env;

// Forwards error-level log entries to Sentry. Matches master branch behaviour
// where @polygonlabs/servercore's Logger.create({ sentry: { level: 'error' } })
// was used. Safe to include even when Sentry is not initialized — Sentry SDK
// methods are no-ops until Sentry.init() has been called.
class SentryTransport extends Transport {
  constructor() {
    super({ level: 'error' });
  }

  override log(info: any, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));
    const err =
      info.error instanceof Error
        ? info.error
        : info.err instanceof Error
          ? info.err
          : undefined;
    if (err) {
      Sentry.captureException(err);
    } else {
      Sentry.captureMessage(
        typeof info.message === 'string' ? info.message : JSON.stringify(info),
        'error',
      );
    }
    callback();
  }
}

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
    transports: [
      new transports.Console(),
      ...(env.SENTRY_DSN ? [new SentryTransport()] : []),
    ],
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
