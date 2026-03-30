import { Router } from 'express';

import { openApiRouter } from './openapi.ts';
import { createV1Router } from './v1.ts';
import { createZkEVMRouter } from './zkEVM.ts';

export function createIndexRouter(): Router {
  const router = Router();
  router.use('/', openApiRouter);
  router.use('/v1', createV1Router());
  router.use('/zkevm', createZkEVMRouter());
  return router;
}
