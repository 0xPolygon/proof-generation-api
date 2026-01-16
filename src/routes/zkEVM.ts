import type { Response, Request } from 'express';

import { Router } from 'express';

import { Logger } from '@polygonlabs/servercore';

import { InfoError } from '../helpers/errorHelper.ts';
import {
  handleBadRequest,
  handleError,
  handleResponse,
} from '../helpers/responseHandlers.ts';
import { bridge, merkelProofGenerator } from '../services/index.ts';
import { isInteger } from './utils.ts';

const router = Router();

function validateZkEVMNetwork(res: Response, network: string | undefined) {
  if (
    network !== 'mainnet' &&
    network !== 'testnet' &&
    network !== 'cherry' &&
    network !== 'cardona'
  ) {
    return handleBadRequest({
      res,
      errMsg: `Invalid network ${network}. Network can either be mainnet, testnet, cherry or cardona for zkEVM routes`,
    });
  }
  return null;
}

function validateNetworkIDAndDepositCount(
  res: Response,
  networkID: string | undefined,
  depositCount: string | undefined,
) {
  if (
    !networkID ||
    !depositCount ||
    !isInteger(networkID) ||
    !isInteger(depositCount)
  ) {
    return handleBadRequest({
      res,
      errMsg: 'Invalid network ID or deposit count!',
    });
  }
  return null;
}

router.get('/bridge', async (req: Request, res: Response) => {
  try {
    const networkID = req.query['net_id'] as string;
    const depositCount = req.query['deposit_cnt'] as string;
    const network = req.params['network'] as string;

    const validationError =
      validateNetworkIDAndDepositCount(res, networkID, depositCount) ||
      validateZkEVMNetwork(res, network);

    if (validationError) {
      return validationError;
    }

    const responseObj = await bridge(
      parseInt(networkID, 10),
      parseInt(depositCount, 10),
      network,
    );
    return handleResponse({ res, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ res, statusCode: 404, err: error });
    }
    Logger.error({ message: 'error in bridge route', error });
    return handleError({ res });
  }
});

router.get('/merkle-proof', async (req: Request, res: Response) => {
  try {
    const networkID = req.query['net_id'] as string;
    const depositCount = req.query['deposit_cnt'] as string;
    const network = req.params['network'] as string;

    const validationError =
      validateNetworkIDAndDepositCount(res, networkID, depositCount) ||
      validateZkEVMNetwork(res, network);

    if (validationError) {
      return validationError;
    }

    const responseObj = await merkelProofGenerator(
      parseInt(networkID, 10),
      parseInt(depositCount, 10),
      network,
    );
    return handleResponse({ res, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ res, statusCode: 404, err: error });
    }
    Logger.error({
      message: 'error in merkelProofGenerator route',
      error,
    });
    return handleError({ res });
  }
});

export { router as zkEVMRoutes };
