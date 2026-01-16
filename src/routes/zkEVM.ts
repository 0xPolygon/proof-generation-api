import { Hono } from 'hono';

import { zkEVMController } from '../controllers/index.ts';
import { validateParams } from '../middleware/index.ts';

const router = new Hono();

router.get(
  '/bridge',
  validateParams.validateZkEVMParams,
  validateParams.validateZkEVMNetworkParam,
  zkEVMController.callBridge,
);

router.get(
  '/merkle-proof',
  validateParams.validateZkEVMParams,
  validateParams.validateZkEVMNetworkParam,
  zkEVMController.callMerkelProofGenerator,
);

export default router;
