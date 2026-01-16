import { Hono } from 'hono';

import { v1Controller } from '../controllers';
import { validateParams } from '../middleware';

const router = new Hono();

router.get(
  '/block-included/:blockNumber',
  validateParams.validateBlockIncludedParams,
  validateParams.validateV1NetworkParam,
  v1Controller.callIsBlockIncluded,
);

router.get(
  '/fast-merkle-proof',
  validateParams.validateFastMerkleProofParams,
  validateParams.validateV1NetworkParam,
  v1Controller.callFastMerkleProof,
);

router.get(
  '/exit-payload/:burnTxHash',
  validateParams.validateExitPayloadParams,
  validateParams.validateV1NetworkParam,
  v1Controller.callExitPayload,
);

router.get(
  '/all-exit-payloads/:burnTxHash',
  validateParams.validateExitPayloadParams,
  validateParams.validateV1NetworkParam,
  v1Controller.callAllExitPayloads,
);

export default router;
