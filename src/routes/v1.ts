import type { Context } from 'hono';

import { Hono } from 'hono';

import { Logger } from '@polygonlabs/servercore';

import { InfoError } from '../helpers/errorHelper.ts';
import {
  handleBadRequest,
  handleError,
  handleResponse,
} from '../helpers/responseHandlers.ts';
import {
  isBlockIncluded,
  fastMerkleProof,
  generateExitPayload,
  generateAllExitPayloads,
} from '../services/index.ts';
import { isInteger } from './utils.ts';

const router = new Hono();

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

function validateV1Network(c: Context, network: string | undefined) {
  if (network !== 'matic' && network !== 'amoy') {
    return handleBadRequest({
      c,
      errMsg: `Invalid network ${network}. Network can either be matic or amoy for PoS v1 routes`,
    });
  }
  return null;
}

function validateBurnTxAndEventSignature(
  c: Context,
  burnTxHash: string | undefined,
  eventSignature: string | undefined,
) {
  if (!burnTxHash || !eventSignature) {
    return handleBadRequest({
      c,
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
      c,
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

router.get('/block-included/:blockNumber', async (c: Context) => {
  try {
    const blockNumber = c.req.param('blockNumber');
    const network = c.req.param('network');

    if (!blockNumber || !isInteger(blockNumber)) {
      return handleBadRequest({
        c,
        errMsg: 'Invalid block number!',
      });
    }

    const validationError = validateV1Network(c, network);
    if (validationError) {
      return validationError;
    }

    const { version, isMainnet } = getV1NetworkDetails(network);

    const responseObj = await isBlockIncluded(blockNumber, isMainnet, version);
    return handleResponse({ c, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ c, statusCode: 404, err: error });
    }
    Logger.error({ message: 'error in isBlockIncluded route', error });
    return handleError({ c });
  }
});

router.get('/fast-merkle-proof', async (c: Context) => {
  try {
    const startParam = c.req.query('start');
    const endParam = c.req.query('end');
    const numberParam = c.req.query('number');
    const network = c.req.param('network');

    if (
      !startParam ||
      !isInteger(startParam) ||
      !endParam ||
      !isInteger(endParam) ||
      !numberParam ||
      !isInteger(numberParam)
    ) {
      return handleBadRequest({
        c,
        errMsg: 'Invalid start, end or block number!',
      });
    }

    const start = parseInt(startParam, 10);
    const end = parseInt(endParam, 10);
    const number = parseInt(numberParam, 10);

    if (end < start || number > end || number < start) {
      return handleBadRequest({
        c,
        errMsg: 'Invalid start or end or block numbers!',
      });
    }

    const validationError = validateV1Network(c, network);
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
      handleError({ c, errMsg: 'Invalid merkle proof created' });
      return;
    }

    return handleResponse({ c, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ c, statusCode: 404, err: error });
    }
    Logger.error({ message: 'error in fastMerkleProof route', error });
    return handleError({ c });
  }
});

router.get('/exit-payload/:burnTxHash', async (c: Context) => {
  try {
    const burnTxHash = c.req.param('burnTxHash');
    const eventSignature = c.req.query('eventSignature');
    const network = c.req.param('network');

    const validationError =
      validateBurnTxAndEventSignature(c, burnTxHash, eventSignature) ||
      validateV1Network(c, network);

    if (validationError) {
      return validationError;
    }

    const { version, isMainnet } = getV1NetworkDetails(network);
    const tokenIndex = parseInt(c.req.query('tokenIndex') || '0', 10);
    const responseObj = await generateExitPayload(
      burnTxHash!,
      eventSignature!,
      tokenIndex,
      isMainnet,
      version,
    );

    return handleResponse({ c, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ c, statusCode: 404, err: error });
    }
    Logger.error({ message: 'error in callExitPayload route', error });
    return handleError({ c });
  }
});

router.get('/all-exit-payloads/:burnTxHash', async (c: Context) => {
  try {
    const burnTxHash = c.req.param('burnTxHash');
    const eventSignature = c.req.query('eventSignature');
    const network = c.req.param('network');

    const validationError =
      validateBurnTxAndEventSignature(c, burnTxHash, eventSignature) ||
      validateV1Network(c, network);

    if (validationError) {
      return validationError;
    }

    const { version, isMainnet } = getV1NetworkDetails(network);

    const responseObj = await generateAllExitPayloads(
      burnTxHash!,
      eventSignature!,
      isMainnet,
      version,
    );

    return handleResponse({ c, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ c, statusCode: 404, err: error });
    }
    Logger.error({ message: 'error in allExitPayloads route', error });
    return handleError({ c });
  }
});

export { router as v1Routes };
