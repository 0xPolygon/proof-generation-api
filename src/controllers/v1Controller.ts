// controller for v1

import { Logger } from '@polygonlabs/servercore'
import { handleError, handleResponse } from '../helpers/responseHandlers'
import {
  isBlockIncluded,
  fastMerkleProof,
  generateExitPayload,
  generateAllExitPayloads
} from '../services'
import { verifyMerkleProof } from '../middleware'
import { InfoError } from '../helpers/errorHelper'
import type { Context } from "hono";

export const callIsBlockIncluded = async (c: Context) => {
  try {
    const { blockNumber } = c.get("validatedBlockIncludedParams");
    const { network } = c.get("validatedV1NetworkParams");

    const version = network === 'matic' ? 'v1' : network
    const isMainnet = network === 'matic'

    const responseObj = await isBlockIncluded(blockNumber, isMainnet, version)
    return handleResponse({ c, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ c, statusCode: 404, err: error })
    } 
    Logger.error({ message: 'error in isBlockIncluded controller', error })
    return handleError({ c })
  }
}

export const callFastMerkleProof = async (c: Context) => {
  try {
    const { start, end, number } = c.get("validatedFastMerkleProofParams");
    const { network } = c.get("validatedV1NetworkParams");

    const version = network === 'matic' ? 'v1' : network
    const isMainnet = network === 'matic'

    const responseObj = await fastMerkleProof(start, end, number, isMainnet, version)

    if (!responseObj || !responseObj.proof || !verifyMerkleProof(number, start, responseObj.proof)) {
      handleError({ c, errMsg: 'Invalid merkle proof created' })
      return;
    }

    return handleResponse({ c, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ c, statusCode: 404, err: error })
    }
    Logger.error({ message: 'error in fastMerkleProof controller', error })
    return handleError({ c })
  }
}

export const callExitPayload = async (c: Context) => {
  try {
    const { burnTxHash, eventSignature } = c.get("validatedExitPayloadParams");
    const { network } = c.get("validatedV1NetworkParams");

    const version = network === 'matic' ? 'v1' : network
    const isMainnet = network === 'matic'
    const tokenIndex = parseInt(c.req.query('tokenIndex') || '0', 10)
    const responseObj = await generateExitPayload(
      burnTxHash,
      eventSignature,
      tokenIndex,
      isMainnet,
      version
    )

    return handleResponse({ c, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ c, statusCode: 404, err: error })
    }
    Logger.error({ message: 'error in callExitPayload controller', error })
    return handleError({ c })
  }
}

export const callAllExitPayloads = async (c: Context) => {
  try {
    const { burnTxHash, eventSignature } = c.get("validatedExitPayloadParams");
    const { network } = c.get("validatedV1NetworkParams");

    const version = network === 'matic' ? 'v1' : network
    const isMainnet = network === 'matic'

    const responseObj = await generateAllExitPayloads(
      burnTxHash,
      eventSignature,
      isMainnet,
      version
    )

    return handleResponse({ c, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ c, statusCode: 404, err: error })
    }
    Logger.error({ message: 'error in allExitPayloads controller', error })
    return handleError({ c })
  }
}
