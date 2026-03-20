// This file must be the first import in src/bin/apiServer.ts so that Sentry
// is initialized before the rest of the module graph loads.
import * as Sentry from '@sentry/node';

import { getEnv } from './env.ts';

const { SENTRY_DSN, NODE_ENV } = getEnv();
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: NODE_ENV
  });
}
