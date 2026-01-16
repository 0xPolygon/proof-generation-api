import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { Logger } from '@polygonlabs/servercore';

import { env } from './env.ts';
import { indexRoutes } from './routes/index.ts';

const app = new Hono();

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
  // app.use("*", logger()); // Logs all requests
  app.use('*', cors()); // Enables CORS for all routes

  // Register routes
  app.route('/api', indexRoutes);

  app.get('/health-check', (c) => {
    return c.json({ success: true, message: 'Health Check Success' }, 200);
  });
}

void serve();

export const serverConfig = {
  port: env.PORT,
  idleTimeout: 120,
  fetch: app.fetch,
};
