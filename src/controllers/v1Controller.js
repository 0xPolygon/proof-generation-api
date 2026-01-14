// controller for v1

import { logger } from '../config/logger.js';
import { handleError, handleResponse } from '../helpers/responseHandlers.js';
import {
  isBlockIncluded as isBlockIncludedService,
  fastMerkleProof as fastMerkleProofService,
  generateExitPayload,
  generateAllExitPayloads,
} from '../services/index.js';
import { verifyMerkleProof } from '../middleware/index.js';
import { InfoError } from '../helpers/errorHelper.js';

export const isBlockIncluded = async (req, res) => {
  try {
    const network = req.params.network;
    const version = network === 'matic' ? 'v1' : network;
    const isMainnet = network === 'matic';
    const blockNumber = req.params.blockNumber;
    const responseObj = await isBlockIncludedService(blockNumber, isMainnet, version);
    handleResponse({ res, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      handleError({ res, statusCode: 404, err: error });
    } else {
      logger.error('error in isBlockIncluded controller\n', error);
      handleError({ res });
    }
  }
};

export const fastMerkleProof = async (req, res) => {
  try {
    const network = req.params.network;
    const version = network === 'matic' ? 'v1' : network;
    const isMainnet = network === 'matic';
    const start = req.query.start;
    const end = req.query.end;
    const number = req.query.number;
    const responseObj = await fastMerkleProofService(start, end, number, isMainnet, version);
    if (!verifyMerkleProof(number, start, responseObj.proof)) {
      handleError({ res, errMsg: 'Invalid merkle proof created' });
      return;
    }
    handleResponse({ res, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      handleError({ res, statusCode: 404, err: error });
    } else {
      logger.error('error in fastMerkleProof controller\n', error);
      handleError({ res });
    }
  }
};

export const exitPayload = async (req, res) => {
  try {
    const network = req.params.network;
    const version = network === 'matic' ? 'v1' : network;
    const isMainnet = network === 'matic';
    const burnTxHash = req.params.burnTxHash;
    const eventSignature = req.query.eventSignature;
    const tokenIndex = req.query.tokenIndex || 0;
    const responseObj = await generateExitPayload(burnTxHash, eventSignature, tokenIndex, isMainnet, version);
    handleResponse({ res, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      handleError({ res, statusCode: 404, err: error });
    } else {
      logger.error('error in exitPayload controller\n', error);
      handleError({ res });
    }
  }
};

export const allExitPayloads = async (req, res) => {
  try {
    const network = req.params.network;
    const version = network === 'matic' ? 'v1' : network;
    const isMainnet = network === 'matic';
    const burnTxHash = req.params.burnTxHash;
    const eventSignature = req.query.eventSignature;
    const responseObj = await generateAllExitPayloads(burnTxHash, eventSignature, isMainnet, version);
    handleResponse({ res, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      handleError({ res, statusCode: 404, err: error });
    } else {
      logger.error('error in allExitPayloads controller\n', error);
      console.log(error.stack);

      handleError({ res });
    }
  }
};
