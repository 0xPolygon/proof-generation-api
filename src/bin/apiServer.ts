// Must be first: initializes Sentry before any other module loads.

import '../sentry.ts';
import { getEnv } from '../env.ts';
import { getExpressApp, startApiServer } from '../index.ts';
import { createLogger } from '../logger.ts';

const logger = await createLogger();

void startApiServer({ port: getEnv().PORT, app: getExpressApp(logger), logger });
