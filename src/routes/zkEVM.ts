import type { Response, Request } from 'express';

import { Router } from 'express';

import { InfoError } from '../helpers/errorHelper.ts';
import { handleBadRequest, handleError, handleResponse } from '../helpers/responseHandlers.ts';
import { getLogger } from '../logger.ts';
import { ZkEVMDepositSchema } from '../schemas.ts';
import { bridge, merkelProofGenerator } from '../services/zkEVMProofGenerationServices.ts';

const router = Router();
const logger = getLogger();

router.get('/:network/bridge', async (req: Request, res: Response) => {
  try {
    const result = ZkEVMDepositSchema.safeParse({ params: req.params, query: req.query });
    if (!result.success) {
      return handleBadRequest({
        res,
        errMsg: result.error.issues[0]?.message ?? 'Invalid request'
      });
    }

    const { network } = result.data.params;
    const { net_id, deposit_cnt } = result.data.query;

    const responseObj = await bridge(net_id, deposit_cnt, network);
    return handleResponse({ res, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ res, statusCode: 404, err: error });
    }
    logger.error({ message: 'error in bridge route', error });
    return handleError({ res });
  }
});

router.get('/:network/merkle-proof', async (req: Request, res: Response) => {
  try {
    const result = ZkEVMDepositSchema.safeParse({ params: req.params, query: req.query });
    if (!result.success) {
      return handleBadRequest({
        res,
        errMsg: result.error.issues[0]?.message ?? 'Invalid request'
      });
    }

    const { network } = result.data.params;
    const { net_id, deposit_cnt } = result.data.query;

    const responseObj = await merkelProofGenerator(net_id, deposit_cnt, network);
    return handleResponse({ res, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ res, statusCode: 404, err: error });
    }
    logger.error({
      message: 'error in merkelProofGenerator route',
      error
    });
    return handleError({ res });
  }
});

export { router as zkEVMRoutes };
