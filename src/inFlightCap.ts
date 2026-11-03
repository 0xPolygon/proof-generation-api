import type { NextFunction, Request, Response } from 'express';

import { ServerBusyError } from './errors.ts';

// Normal busy hours are ~3 rps across 3-5 pods at 1-2s per request, i.e. a handful in
// flight per pod; 25 leaves generous headroom while still bounding the work a burst can
// pile up on one pod before every other route starts timing out.
export const MAX_IN_FLIGHT_EXIT_PAYLOADS = 25;

const RETRY_AFTER_SECONDS = 5;

// One counter per process, shared by every route this middleware is mounted on.
let inFlight = 0;

export function capInFlightExitPayloads(_req: Request, res: Response, next: NextFunction): void {
  if (inFlight >= MAX_IN_FLIGHT_EXIT_PAYLOADS) {
    res.set('Retry-After', String(RETRY_AFTER_SECONDS));
    next(new ServerBusyError('Server is busy, please retry shortly'));
    return;
  }

  inFlight += 1;
  // 'close' fires exactly once per response, whether it finished, errored or the client
  // aborted, so the slot is always released.
  res.once('close', () => {
    inFlight -= 1;
  });
  next();
}
