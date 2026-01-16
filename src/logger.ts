import type { LoggerOptions, Logger } from 'winston';

import {
  createLogger as createWinstonLogger,
  format,
  transports,
} from 'winston';

export function createLogger(config?: LoggerOptions) {
  return createWinstonLogger({
    format: format.json(),
    transports: [new transports.Console()],
    ...config,
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
