import cors from 'cors';
import express, { json } from 'express';

import { Logger } from '@polygonlabs/servercore';

import { env } from './env.ts';
import { indexRoutes } from './routes/index.ts';

const app = express();

async function serve(): Promise<void> {
  const loggerConfig: any = {
    console: {
      level: 'debug',
    },
  };

  if (env.SENTRY_DSN) {
    loggerConfig.sentry = {
      dsn: env.SENTRY_DSN,
      level: 'error',
    };
  }

  Logger.create(loggerConfig);

  // Middlewares
  app.use(cors()); // Enables CORS for all routes
  app.use(json()); // Parse JSON bodies

  // Register routes
  app.use('/api', indexRoutes);

  app.get('/health-check', (_req, res) => {
    res.status(200).json({ success: true, message: 'Health Check Success' });
  });

  app.listen(env.PORT, () => {
    Logger.info({ message: `Server started on port ${env.PORT}` });
  });
}

void serve();

export const serverConfig = {
  port: env.PORT,
  idleTimeout: 120,
};
