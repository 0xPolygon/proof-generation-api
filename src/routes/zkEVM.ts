import { Hono } from 'hono'
import { validateParams } from '../middleware';
import { zkEVMController } from '../controllers'

const router = new Hono();

router.get(
    '/bridge',
    validateParams.validateZkEVMParams,
    validateParams.validateZkEVMNetworkParam,
    zkEVMController.callBridge
)

router.get(
    '/merkle-proof',
    validateParams.validateZkEVMParams,
    validateParams.validateZkEVMNetworkParam,
    zkEVMController.callMerkelProofGenerator
)

export default router
