import type { MiddlewareHandler } from "hono";
import { handleBadRequest } from '../helpers/responseHandlers'

export const validateV1NetworkParam: MiddlewareHandler = async (
  context,
  next
) => {
  const network = context.req.param('network');

  if (network !== 'matic' && network !== 'amoy') {
    return handleBadRequest({
      c: context,
      errMsg: `Invalid network ${network}. Network can either be matic or amoy for PoS v1 routes`
    })
  }
  context.set("validatedV1NetworkParams", {
    network
  });
  await next();
};

export const validateZkEVMNetworkParam: MiddlewareHandler = async (
  context,
  next
) => {
  const network = context.req.param('network');

  if (network !== 'mainnet' && network !== 'testnet' && network !== 'cherry' && network !== 'cardona') {
    return handleBadRequest({
      c: context,
      errMsg: `Invalid network ${network}. Network can either be mainnet, testnet, cherry or cardona for zkEVM routes`
    })
  }
  context.set("validatedZkevmNetworkParams", {
    network
  });
  await next();
};

export const validateBlockIncludedParams: MiddlewareHandler = async (
  context,
  next
) => {
  const blockNumber = context.req.param('blockNumber');

  if (!blockNumber || !isInteger(blockNumber)) {
    return handleBadRequest({
      c: context,
      errMsg: 'Invalid block number!'
    })
  }

  context.set("validatedBlockIncludedParams", {
    blockNumber: parseInt(blockNumber, 10)
  });
  await next();
};

export const validateFastMerkleProofParams: MiddlewareHandler = async (
  context,
  next
) => {
  const startParam = context.req.query('start');
  const endParam = context.req.query('end');
  const numberParam = context.req.query('number');

  if (!startParam || !isInteger(startParam) || !endParam || !isInteger(endParam) || !numberParam || !isInteger(numberParam)) {
    return handleBadRequest({
      c: context,
      errMsg: 'Invalid start, end or block number!'
    })
  }

  const start = parseInt(startParam, 10)
  const end = parseInt(endParam, 10)
  const number = parseInt(numberParam, 10)

  if (end < start || number > end || number < start) {
    return handleBadRequest({
      c: context,
      errMsg: 'Invalid start or end or block numbers!'
    })
  }

  context.set("validatedFastMerkleProofParams", {
    start,
    end,
    number
  });

  await next();
};

export const validateExitPayloadParams: MiddlewareHandler = async (
  context,
  next
) => {
  const burnTxHash = context.req.param('burnTxHash');
  const eventSignature = context.req.query('eventSignature');

  if (!burnTxHash || !eventSignature) {
    return handleBadRequest({
      c: context,
      errMsg: 'Invalid burnTxHash or eventSignature!'
    })
  }

  if (
    !burnTxHash.startsWith('0x') ||
    !eventSignature.startsWith('0x') ||
    burnTxHash.length !== 66 ||
    eventSignature.length !== 66
  ) {
    return handleBadRequest({
      c: context,
      errMsg: 'Incorrect Burn tx or Event Signature!'
    })
  }

  context.set("validatedExitPayloadParams", {
    burnTxHash,
    eventSignature
  });

  await next();
};

export const validateZkEVMParams: MiddlewareHandler = async (
  context,
  next
) => {
  const networkID = context.req.query('net_id');
  const depositCount = context.req.query('deposit_cnt');

  if (!networkID || !depositCount || !isInteger(networkID) || !isInteger(depositCount)) {
    return handleBadRequest({
      c: context,
      errMsg: 'Invalid network ID or deposit count!'
    })
  }

  context.set("validatedZkevmParams", {
    networkID: parseInt(networkID, 10),
    depositCount: parseInt(depositCount, 10)
  });
  await next();
};

const isInteger = (str: string): boolean => {
  str = str.trim()
  if (!str) {
    return false
  }
  str = str.replace(/^0+/, '') || '0'
  const n = Math.floor(Number(str))
  return n !== Infinity && String(n) === str && n >= 0
}
