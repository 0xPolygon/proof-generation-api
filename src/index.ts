import type { Express, NextFunction, Request, Response } from 'express';

import { randomUUID } from 'node:crypto';

import cors from 'cors';
import express, { json } from 'express';

import { HTTPError } from '@polygonlabs/verror';

import type { Logger } from './logger.ts';

import { warmMaticClients } from './maticClient.ts';
import { createIndexRouter } from './routes/index.ts';

// Attach a per-request child logger to req.log so every log entry for a
// single request shares the same requestId and can be correlated in Datadog.
declare module 'express-serve-static-core' {
  interface Request {
    log: Logger;
  }
}

/** Useful for testing the app using Supertest (it will automatically listen on a random port) */
export function getExpressApp(logger: Logger): Express {
  const app = express();

  app.use(cors()); // Enables CORS for all routes
  app.use(json()); // Parse JSON bodies

  app.use((req, _res, next) => {
    req.log = logger.child({ requestId: randomUUID() });
    next();
  });

  app.use('/api', createIndexRouter());

  app.get('/health-check', (_req, res) => {
    res.status(200).json({ success: true, message: 'Health Check Success' });
  });

  // Central error handler — catches HTTPError subclasses thrown from routes and maps
  // their statusCode to the response. The full VError cause chain is visible in
  // the log entry; the client receives only the immediate error message.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HTTPError) {
      if (err.statusCode >= 500) {
        req.log.error({ err });
      } else {
        req.log.debug({ err });
      }
      res.status(err.statusCode).json({ error: true, message: err.message });
      return;
    }
    const wrappedErr = err instanceof Error ? err : new Error(String(err));
    req.log.error({ err: wrappedErr });
    res.status(500).json({ error: true, message: 'Something went wrong while computing' });
  });

  return app;
}

/** Production entrypoint */
export async function startApiServer({
  port,
  app,
  logger
}: {
  port: number;
  app: Express;
  logger: Logger;
}): Promise<void> {
  // Warm the RPC providers before opening the listen socket: /health-check has no
  // RPC dependency and is the sole readiness signal the shared docker-test composite
  // waits on, so without this a POSClient's maiden detectNetwork() call — a cold
  // DNS+TLS+RPC round trip in a fresh container network namespace — can lose the
  // race against the steady-state 2-attempt retry budget on a real request.
  try {
    await warmMaticClients(logger);
  } catch (err: unknown) {
    logger.warn(
      { err: err instanceof Error ? err : new Error(String(err)) },
      'RPC provider warm-up failed; continuing startup'
    );
  }

  // Bubble errors calling `listen()` up to callers so they get an async stack trace
  await new Promise((resolve, reject) => {
    app.listen(port).once('listening', resolve).once('error', reject);
  });

  logger.info(`Proof Generation API server has started on port ${port}`);
}
