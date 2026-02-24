// This file must be the first import in src/bin/apiServer.ts so that Sentry
// is initialized before the rest of the module graph loads.
import * as Sentry from '@sentry/node';

import { env } from './env.ts';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV
  });
}
