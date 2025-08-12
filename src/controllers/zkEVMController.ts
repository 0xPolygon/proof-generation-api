// controller for zkEVM

import { Logger } from '@polygonlabs/servercore'
import { handleError, handleResponse } from '../helpers/responseHandlers'
import { bridge, merkelProofGenerator } from '../services'
import { InfoError } from '../helpers/errorHelper'
import type { Context } from "hono";

export const callBridge = async (c: Context) => {
  try {
    const { networkID, depositCount } = c.get("validatedZkevmParams");
    const { network } = c.get("validatedZkevmNetworkParams");
    const responseObj = await bridge(
      networkID,
      depositCount,
      network
    )
    return handleResponse({ c, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      handleError({ c, statusCode: 404, err: error })
    } else {
      Logger.error({ message: 'error in bridge controller', error })
      handleError({ c })
    }
  }
}

export const callMerkelProofGenerator = async (c: Context) => {
  try {
    const { networkID, depositCount } = c.get("validatedZkevmParams");
    const { network } = c.get("validatedZkevmNetworkParams");
    const responseObj = await merkelProofGenerator(
      networkID,
      depositCount,
      network
    )
    return handleResponse({ c, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      handleError({ c, statusCode: 404, err: error })
    } else {
      Logger.error({ message: 'error in merkelProofGenerator controller', error })
      handleError({ c })
    }
  }
}
