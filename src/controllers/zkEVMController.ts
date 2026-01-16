// controller for zkEVM

import type { Context } from 'hono';

import { Logger } from '@polygonlabs/servercore';

import { InfoError } from '../helpers/errorHelper';
import { handleError, handleResponse } from '../helpers/responseHandlers';
import { bridge, merkelProofGenerator } from '../services';

export const callBridge = async (c: Context) => {
  try {
    const { networkID, depositCount } = c.get('validatedZkevmParams');
    const { network } = c.get('validatedZkevmNetworkParams');
    const responseObj = await bridge(networkID, depositCount, network);
    return handleResponse({ c, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ c, statusCode: 404, err: error });
    }
    Logger.error({ message: 'error in bridge controller', error });
    return handleError({ c });
  }
};

export const callMerkelProofGenerator = async (c: Context) => {
  try {
    const { networkID, depositCount } = c.get('validatedZkevmParams');
    const { network } = c.get('validatedZkevmNetworkParams');
    const responseObj = await merkelProofGenerator(
      networkID,
      depositCount,
      network,
    );
    return handleResponse({ c, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ c, statusCode: 404, err: error });
    }
    Logger.error({
      message: 'error in merkelProofGenerator controller',
      error,
    });
    return handleError({ c });
  }
};
