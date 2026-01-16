import type { MiddlewareHandler } from 'hono';

import { Hono } from 'hono';

import { zkEVMController } from '../controllers/index.ts';
import { handleBadRequest } from '../helpers/responseHandlers.ts';
import { isInteger } from './utils.ts';

const router = new Hono();

const validateZkEVMNetworkParam: MiddlewareHandler = async (context, next) => {
  const network = context.req.param('network');

  if (
    network !== 'mainnet' &&
    network !== 'testnet' &&
    network !== 'cherry' &&
    network !== 'cardona'
  ) {
    return handleBadRequest({
      c: context,
      errMsg: `Invalid network ${network}. Network can either be mainnet, testnet, cherry or cardona for zkEVM routes`,
    });
  }

  context.set('validatedZkevmNetworkParams', {
    network,
  });
  return await next();
};

const validateZkEVMParams: MiddlewareHandler = async (context, next) => {
  const networkID = context.req.query('net_id');
  const depositCount = context.req.query('deposit_cnt');

  if (
    !networkID ||
    !depositCount ||
    !isInteger(networkID) ||
    !isInteger(depositCount)
  ) {
    return handleBadRequest({
      c: context,
      errMsg: 'Invalid network ID or deposit count!',
    });
  }

  context.set('validatedZkevmParams', {
    networkID: parseInt(networkID, 10),
    depositCount: parseInt(depositCount, 10),
  });

  return await next();
};

router.get(
  '/bridge',
  validateZkEVMParams,
  validateZkEVMNetworkParam,
  zkEVMController.callBridge,
);

router.get(
  '/merkle-proof',
  validateZkEVMParams,
  validateZkEVMNetworkParam,
  zkEVMController.callMerkelProofGenerator,
);

export { router as zkEVMRoutes };
