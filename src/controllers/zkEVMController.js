// controller for zkEVM

import { logger } from '../config/logger.js';
import { handleError, handleResponse } from '../helpers/responseHandlers.js';
import { bridge as bridgeService, merkelProofGenerator as merkelProofGeneratorService } from '../services/index.js';
import { InfoError } from '../helpers/errorHelper.js';

export const bridge = async (req, res) => {
  try {
    const networkID = req.query.net_id;
    const depositCount = req.query.deposit_cnt;
    const network = req.params.network;
    const responseObj = await bridgeService(networkID, depositCount, network);
    handleResponse({ res, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      handleError({ res, statusCode: 404, err: error });
    } else {
      logger.error('error in bridge controller\n', error);
      handleError({ res });
    }
  }
};

export const merkelProofGenerator = async (req, res) => {
  try {
    const networkID = req.query.net_id;
    const depositCount = req.query.deposit_cnt;
    const network = req.params.network;
    const responseObj = await merkelProofGeneratorService(networkID, depositCount, network);
    handleResponse({ res, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      handleError({ res, statusCode: 404, err: error });
    } else {
      logger.error('error in merkelProofGenerator controller\n', error);
      handleError({ res });
    }
  }
};
