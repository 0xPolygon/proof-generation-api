import { Hono } from 'hono';

import { zkEVMController } from '../controllers';
import { validateParams } from '../middleware';

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
