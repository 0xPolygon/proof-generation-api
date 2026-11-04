import type { Express, NextFunction, Request, Response } from 'express';

import { randomUUID } from 'node:crypto';

import cors from 'cors';
import express, { json } from 'express';

import { HTTPError } from '@polygonlabs/verror';

import type { Logger } from './logger.ts';

import { ServerBusyError } from './errors.ts';
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

  // Mounted before every other middleware: an error raised by an earlier one (e.g. a
  // malformed JSON body rejected by json()) jumps straight to the error handler, which
  // logs through req.log. Without it the handler itself threw, and Express printed that
  // TypeError to stderr as unstructured text instead of a JSON log line.
  app.use((req, _res, next) => {
    req.log = logger.child({ requestId: randomUUID() });
    next();
  });

  app.use(cors()); // Enables CORS for all routes
  app.use(json()); // Parse JSON bodies

  app.use('/api', createIndexRouter());

  app.get('/health-check', (_req, res) => {
    res.status(200).json({ success: true, message: 'Health Check Success' });
  });

  // Central error handler — catches HTTPError subclasses thrown from routes and maps
  // their statusCode to the response. The full VError cause chain is visible in
  // the log entry; the client receives only the immediate error message.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HTTPError) {
      // Shed load silently: a burst of rejections would flood logs and Sentry, and the
      // 503s are already visible in request metrics.
      if (err instanceof ServerBusyError) {
        // no log
      } else if (err.statusCode >= 500) {
        req.log.error({ err });
      } else {
        req.log.debug({ err });
      }
      res.status(err.statusCode).json({ error: true, message: err.message });
      return;
    }
    // Middleware errors (body-parser's http-errors) carry a client-facing 4xx `status`;
    // they describe a bad request, not a server fault, so answer with that status.
    if (
      err instanceof Error &&
      'status' in err &&
      typeof err.status === 'number' &&
      err.status >= 400 &&
      err.status < 500
    ) {
      req.log.debug({ err });
      res.status(err.status).json({ error: true, message: err.message });
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
  // Bubble errors calling `listen()` up to callers so they get an async stack trace
  await new Promise((resolve, reject) => {
    app.listen(port).once('listening', resolve).once('error', reject);
  });

  logger.info(`Proof Generation API server has started on port ${port}`);
}
