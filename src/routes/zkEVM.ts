import type { Context } from 'hono';

import { Hono } from 'hono';

import { Logger } from '@polygonlabs/servercore';

import { InfoError } from '../helpers/errorHelper.ts';
import {
  handleBadRequest,
  handleError,
  handleResponse,
} from '../helpers/responseHandlers.ts';
import { bridge, merkelProofGenerator } from '../services/index.ts';
import { isInteger } from './utils.ts';

const router = new Hono();

function validateZkEVMNetwork(c: Context, network: string | undefined) {
  if (
    network !== 'mainnet' &&
    network !== 'testnet' &&
    network !== 'cherry' &&
    network !== 'cardona'
  ) {
    return handleBadRequest({
      c,
      errMsg: `Invalid network ${network}. Network can either be mainnet, testnet, cherry or cardona for zkEVM routes`,
    });
  }
  return null;
}

function validateNetworkIDAndDepositCount(
  c: Context,
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
      c,
      errMsg: 'Invalid network ID or deposit count!',
    });
  }
  return null;
}

router.get('/bridge', async (c: Context) => {
  try {
    const networkID = c.req.query('net_id');
    const depositCount = c.req.query('deposit_cnt');
    const network = c.req.param('network');

    const validationError =
      validateNetworkIDAndDepositCount(c, networkID, depositCount) ||
      validateZkEVMNetwork(c, network);

    if (validationError) {
      return validationError;
    }

    const responseObj = await bridge(
      parseInt(networkID!, 10),
      parseInt(depositCount!, 10),
      network!,
    );
    return handleResponse({ c, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ c, statusCode: 404, err: error });
    }
    Logger.error({ message: 'error in bridge route', error });
    return handleError({ c });
  }
});

router.get('/merkle-proof', async (c: Context) => {
  try {
    const networkID = c.req.query('net_id');
    const depositCount = c.req.query('deposit_cnt');
    const network = c.req.param('network');

    const validationError =
      validateNetworkIDAndDepositCount(c, networkID, depositCount) ||
      validateZkEVMNetwork(c, network);

    if (validationError) {
      return validationError;
    }

    const responseObj = await merkelProofGenerator(
      parseInt(networkID!, 10),
      parseInt(depositCount!, 10),
      network!,
    );
    return handleResponse({ c, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ c, statusCode: 404, err: error });
    }
    Logger.error({
      message: 'error in merkelProofGenerator route',
      error,
    });
    return handleError({ c });
  }
});

export { router as zkEVMRoutes };
