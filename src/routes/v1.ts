import type { MiddlewareHandler } from 'hono';

import { Hono } from 'hono';

import { v1Controller } from '../controllers/index.ts';
import { handleBadRequest } from '../helpers/responseHandlers.ts';
import { isInteger } from './utils.ts';

const router = new Hono();

const validateV1NetworkParam: MiddlewareHandler = async (context, next) => {
  const network = context.req.param('network');

  if (network !== 'matic' && network !== 'amoy') {
    return handleBadRequest({
      c: context,
      errMsg: `Invalid network ${network}. Network can either be matic or amoy for PoS v1 routes`,
    });
  }
  context.set('validatedV1NetworkParams', {
    network,
  });

  return await next();
};

const validateBlockIncludedParams: MiddlewareHandler = async (
  context,
  next,
) => {
  const blockNumber = context.req.param('blockNumber');

  if (!blockNumber || !isInteger(blockNumber)) {
    return handleBadRequest({
      c: context,
      errMsg: 'Invalid block number!',
    });
  }

  context.set('validatedBlockIncludedParams', {
    blockNumber: parseInt(blockNumber, 10),
  });
  return await next();
};

const validateFastMerkleProofParams: MiddlewareHandler = async (
  context,
  next,
) => {
  const startParam = context.req.query('start');
  const endParam = context.req.query('end');
  const numberParam = context.req.query('number');

  if (
    !startParam ||
    !isInteger(startParam) ||
    !endParam ||
    !isInteger(endParam) ||
    !numberParam ||
    !isInteger(numberParam)
  ) {
    return handleBadRequest({
      c: context,
      errMsg: 'Invalid start, end or block number!',
    });
  }

  const start = parseInt(startParam, 10);
  const end = parseInt(endParam, 10);
  const number = parseInt(numberParam, 10);

  if (end < start || number > end || number < start) {
    return handleBadRequest({
      c: context,
      errMsg: 'Invalid start or end or block numbers!',
    });
  }

  context.set('validatedFastMerkleProofParams', {
    start,
    end,
    number,
  });

  return await next();
};

const validateExitPayloadParams: MiddlewareHandler = async (context, next) => {
  const burnTxHash = context.req.param('burnTxHash');
  const eventSignature = context.req.query('eventSignature');

  if (!burnTxHash || !eventSignature) {
    return handleBadRequest({
      c: context,
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
      c: context,
      errMsg: 'Incorrect Burn tx or Event Signature!',
    });
  }

  context.set('validatedExitPayloadParams', {
    burnTxHash,
    eventSignature,
  });

  return await next();
};

router.get(
  '/block-included/:blockNumber',
  validateBlockIncludedParams,
  validateV1NetworkParam,
  v1Controller.callIsBlockIncluded,
);

router.get(
  '/fast-merkle-proof',
  validateFastMerkleProofParams,
  validateV1NetworkParam,
  v1Controller.callFastMerkleProof,
);

router.get(
  '/exit-payload/:burnTxHash',
  validateExitPayloadParams,
  validateV1NetworkParam,
  v1Controller.callExitPayload,
);

router.get(
  '/all-exit-payloads/:burnTxHash',
  validateExitPayloadParams,
  validateV1NetworkParam,
  v1Controller.callAllExitPayloads,
);

export { router as v1Routes };
