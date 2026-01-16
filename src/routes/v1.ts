import type { Response, Request } from 'express';

import { Router } from 'express';

import { InfoError } from '../helpers/errorHelper.ts';
import {
  handleBadRequest,
  handleError,
  handleResponse,
} from '../helpers/responseHandlers.ts';
import { getLogger } from '../logger.ts';
import {
  isBlockIncluded,
  fastMerkleProof,
  generateExitPayload,
  generateAllExitPayloads,
} from '../services/index.ts';
import { isInteger } from './utils.ts';

const logger = getLogger();
const router = Router();

/**
 * Verify merkle proof
 *
 * @param {String} number
 * @param {String} start
 * @param {String} proof
 * @returns {Boolean}
 */
function verifyMerkleProof(number: string, start: string, proof: string) {
  const index = parseInt(number, 10) - parseInt(start, 10);
  if (!proof) {
    return false;
  }

  const proofLength = Buffer.from(proof.replace('0x', '')).length;
  if (proofLength % 32 !== 0) {
    return false;
  }

  const proofHeight = proofLength / 32;
  // Proof of size n means, height of the tree is n+1.
  // In a tree of height n+1, max #leafs possible is 2 ^ n
  return index < 2 ** proofHeight;
}

function validateV1Network(res: Response, network: string | undefined) {
  if (network !== 'matic' && network !== 'amoy') {
    return handleBadRequest({
      res,
      errMsg: `Invalid network ${network}. Network can either be matic or amoy for PoS v1 routes`,
    });
  }
  return null;
}

function validateBurnTxAndEventSignature(
  res: Response,
  burnTxHash: string | undefined,
  eventSignature: string | undefined,
) {
  if (!burnTxHash || !eventSignature) {
    return handleBadRequest({
      res,
      errMsg: 'Invalid burnTxHash or eventSignature!',
    });
  }

  if (
    !burnTxHash.startsWith('0x') ||
    !eventSignature.startsWith('0x') ||
    burnTxHash.length !== 66 ||
    eventSignature.length !== 66
  ) {
    return handleBadRequest({
      res,
      errMsg: 'Incorrect Burn tx or Event Signature!',
    });
  }
  return null;
}

function getV1NetworkDetails(network: string | undefined) {
  const version = network === 'matic' ? 'v1' : network!;
  const isMainnet = network === 'matic';
  return { version, isMainnet };
}

router.get(
  '/block-included/:blockNumber',
  async (req: Request, res: Response) => {
    try {
      const blockNumber = req.params['blockNumber'] as string;
      const network = req.params['network'] as string;

      if (!blockNumber || !isInteger(blockNumber)) {
        return handleBadRequest({
          res,
          errMsg: 'Invalid block number!',
        });
      }

      const validationError = validateV1Network(res, network);
      if (validationError) {
        return validationError;
      }

      const { version, isMainnet } = getV1NetworkDetails(network);

      const responseObj = await isBlockIncluded(
        blockNumber,
        isMainnet,
        version,
      );
      return handleResponse({ res, data: responseObj });
    } catch (error) {
      if (error instanceof InfoError) {
        return handleError({ res, statusCode: 404, err: error });
      }
      logger.error({ message: 'error in isBlockIncluded route', error });
      return handleError({ res });
    }
  },
);

router.get('/fast-merkle-proof', async (req: Request, res: Response) => {
  try {
    const startParam = req.query['start'] as string;
    const endParam = req.query['end'] as string;
    const numberParam = req.query['number'] as string;
    const network = req.params['network'] as string;

    if (
      !startParam ||
      !isInteger(startParam) ||
      !endParam ||
      !isInteger(endParam) ||
      !numberParam ||
      !isInteger(numberParam)
    ) {
      return handleBadRequest({
        res,
        errMsg: 'Invalid start, end or block number!',
      });
    }

    const start = parseInt(startParam, 10);
    const end = parseInt(endParam, 10);
    const number = parseInt(numberParam, 10);

    if (end < start || number > end || number < start) {
      return handleBadRequest({
        res,
        errMsg: 'Invalid start or end or block numbers!',
      });
    }

    const validationError = validateV1Network(res, network);
    if (validationError) {
      return validationError;
    }

    const { version, isMainnet } = getV1NetworkDetails(network);

    const responseObj = await fastMerkleProof(
      startParam,
      endParam,
      number,
      isMainnet,
      version,
    );

    if (
      !responseObj ||
      !responseObj.proof ||
      !verifyMerkleProof(numberParam, startParam, responseObj.proof)
    ) {
      handleError({ res, errMsg: 'Invalid merkle proof created' });
      return;
    }

    return handleResponse({ res, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ res, statusCode: 404, err: error });
    }
    logger.error({ message: 'error in fastMerkleProof route', error });
    return handleError({ res });
  }
});

router.get('/exit-payload/:burnTxHash', async (req: Request, res: Response) => {
  try {
    const burnTxHash = req.params['burnTxHash'] as string;
    const eventSignature = req.query['eventSignature'] as string;
    const network = req.params['network'] as string;

    const validationError =
      validateBurnTxAndEventSignature(res, burnTxHash, eventSignature) ||
      validateV1Network(res, network);

    if (validationError) {
      return validationError;
    }

    const { version, isMainnet } = getV1NetworkDetails(network);
    const tokenIndex = parseInt((req.query['tokenIndex'] as string) || '0', 10);
    const responseObj = await generateExitPayload(
      burnTxHash,
      eventSignature,
      tokenIndex,
      isMainnet,
      version,
    );

    return handleResponse({ res, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ res, statusCode: 404, err: error });
    }
    logger.error({ message: 'error in callExitPayload route', error });
    return handleError({ res });
  }
});

router.get(
  '/all-exit-payloads/:burnTxHash',
  async (req: Request, res: Response) => {
    try {
      const burnTxHash = req.params['burnTxHash'] as string;
      const eventSignature = req.query['eventSignature'] as string;
      const network = req.params['network'] as string;

      const validationError =
        validateBurnTxAndEventSignature(res, burnTxHash, eventSignature) ||
        validateV1Network(res, network);

      if (validationError) {
        return validationError;
      }

      const { version, isMainnet } = getV1NetworkDetails(network);

      const responseObj = await generateAllExitPayloads(
        burnTxHash,
        eventSignature,
        isMainnet,
        version,
      );

      return handleResponse({ res, data: responseObj });
    } catch (error) {
      if (error instanceof InfoError) {
        return handleError({ res, statusCode: 404, err: error });
      }
      logger.error({ message: 'error in allExitPayloads route', error });
      return handleError({ res });
    }
  },
);

export { router as v1Routes };
