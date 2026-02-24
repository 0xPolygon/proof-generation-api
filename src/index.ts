import type { Express } from 'express';

import cors from 'cors';
import express, { json } from 'express';

import { env } from './env.ts';
import { getLogger } from './logger.ts';
import { indexRoutes } from './routes/index.ts';

const logger = getLogger();

/** Useful for testing the app using Supertest (it will automatically listen on a random port) */
export function getExpressApp() {
  const app = express();

  app.use(cors()); // Enables CORS for all routes
  app.use(json()); // Parse JSON bodies

  app.use('/api', indexRoutes);

  app.get('/health-check', (_req, res) => {
    res.status(200).json({ success: true, message: 'Health Check Success' });
  });

  return app;
}

/** Production entrypoint; defaults to listening on env.PORT */
export async function startApiServer(
  { port, app }: { port: number; app: Express } = {
    port: env.PORT,
    app: getExpressApp()
  }
): Promise<void> {
  // Bubble errors calling `listen()` up to callers so they get an async stack trace
  await new Promise((resolve, reject) => {
    app.listen(port).once('listening', resolve).once('error', reject);
  });

  logger.info(`Proof Generation API server has started on port ${port}`);
}
