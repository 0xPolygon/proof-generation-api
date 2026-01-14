// validate parameters received

import { handleBadRequest, handleError } from '../helpers/responseHandlers.js';
import { logger } from '../config/logger.js';

const SUPPORTED_V1_NETWORKS = ['matic', 'amoy'];
const SUPPORTED_ZK_NETWORKS = ['mainnet', 'testnet', 'cherry', 'blueberry', 'cardona'];

// network params validation for PoS v1
export const validateV1NetworkParam = (req, res, next) => {
  const network = req.params.network;
  try {
    if (!SUPPORTED_V1_NETWORKS.includes(network)) {
      return handleBadRequest({
        res,
        errMsg: `Invalid network ${network}. Network can either be ${SUPPORTED_V1_NETWORKS.join(' or ')} for PoS v1 routes`,
      });
    }
    next();
  } catch (error) {
    logger.error('error in validateV1NetworkParam', error);
    handleError({
      res,
      errMsg: 'Something went wrong while validating params',
    });
  }
};

// network params validation for zkEVM
export const validateZkEVMNetworkParam = (req, res, next) => {
  const network = req.params.network;
  try {
    if (!SUPPORTED_ZK_NETWORKS.includes(network)) {
      return handleBadRequest({
        res,
        errMsg: `Invalid network ${network}. Network can either be ${SUPPORTED_ZK_NETWORKS.join(' or ')} for zkEVM routes`,
      });
    }
    next();
  } catch (error) {
    logger.error('error in validateZkEVMNetworkParam', error);
    handleError({
      res,
      errMsg: 'Something went wrong while validating params',
    });
  }
};

// block-included params validation
export const validateBlockIncludedParams = (req, res, next) => {
  const blockNumber = req.params.blockNumber;
  try {
    // block number must be an integer
    if (!isInteger(blockNumber)) {
      return handleBadRequest({
        res,
        errMsg: 'Invalid block number!',
      });
    }
    next();
  } catch (error) {
    logger.error('error in validateBlockIncluded Params', error);
    handleError({
      res,
      errMsg: 'Something went wrong while validating params',
    });
  }
};

// fast-merkle-proof params validation
export const validateFastMerkleProofParams = (req, res, next) => {
  let start = req.query.start;
  let end = req.query.end;
  let number = req.query.number;

  try {
    // params must be integers
    const invalidArgs = !isInteger(start) || !isInteger(end) | !isInteger(number);

    start = parseInt(start, 10);
    end = parseInt(end, 10);
    number = parseInt(number, 10);

    // start must be less than or equal to number
    // end must be greater than or equal to start
    if (invalidArgs || end < start || number > end || number < start) {
      return handleBadRequest({
        res,
        errMsg: 'Invalid start or end or block numbers!',
      });
    }
    next();
  } catch (error) {
    logger.error('error in validateFastMerkleProof Params', error);
    handleError({
      res,
      errMsg: 'Something went wrong while validating params',
    });
  }
};

// exit-payload params validation
export const validateExitPayloadParams = (req, res, next) => {
  const burnTxHash = req.params.burnTxHash;
  const eventSignature = req.query.eventSignature;

  try {
    // burn tx hash and event signature are required
    if (!burnTxHash || !eventSignature) {
      return handleBadRequest({
        res,
        errMsg: 'Burn tx or Event Signature missing!',
      });
    }

    // burn tx hash and event signature must be strings, start with 0x, and have length 66
    if (
      typeof burnTxHash !== 'string' ||
      typeof eventSignature !== 'string' ||
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
    next();
  } catch (error) {
    logger.error('error in validateExitPayload Params', error);
    handleError({
      res,
      errMsg: 'Something went wrong while validating params',
    });
  }
};

// zkEVM params validation
export const validateZkEVMParams = (req, res, next) => {
  const networkID = req.query.net_id;
  const depositCount = req.query.deposit_cnt;
  try {
    // block number must be an integer
    if (!isInteger(networkID) && !isInteger(depositCount)) {
      return handleBadRequest({
        res,
        errMsg: 'Invalid network ID or deposit count!',
      });
    }
    next();
  } catch (error) {
    logger.error('error in validateZkEVMParams Params', error);
    handleError({
      res,
      errMsg: 'Something went wrong while validating params',
    });
  }
};

function isInteger(str) {
  str = str.trim();
  if (!str) {
    return false;
  }
  str = str.replace(/^0+/, '') || '0';
  const n = Math.floor(Number(str));
  return n !== Infinity && String(n) === str && n >= 0;
}
