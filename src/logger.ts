import * as Sentry from '@sentry/node';

import type { Logger, SentryAdapter } from '@polygonlabs/logger';

import { createLogger as createPinoLogger } from '@polygonlabs/logger';

import { getEnv } from './env.ts';

export type { Logger };

export async function createLogger(): Promise<Logger> {
  const { PRETTY_LOGS, SENTRY_DSN } = getEnv();
  return createPinoLogger({
    pretty: PRETTY_LOGS,
    ...(SENTRY_DSN ? { sentry: Sentry as unknown as SentryAdapter } : {})
  });
}
