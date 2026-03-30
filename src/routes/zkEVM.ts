import type { Request, Response } from 'express';

import { Router } from 'express';

import { BadRequest } from '@polygonlabs/verror';

import { ZkEVMDepositSchema } from '../schemas.ts';
import { bridge, merkelProofGenerator } from '../services/zkEVMProofGenerationServices.ts';

export function createZkEVMRouter(): Router {
  const router = Router();

  router.get('/:network/bridge', async (req: Request, res: Response) => {
    const result = ZkEVMDepositSchema.safeParse({ params: req.params, query: req.query });
    if (!result.success) {
      throw new BadRequest(result.error.issues[0]?.message ?? 'Invalid request');
    }

    const { network } = result.data.params;
    const { net_id, deposit_cnt } = result.data.query;

    const responseObj = await bridge(net_id, deposit_cnt, network, req.log);
    res.json(responseObj);
  });

  router.get('/:network/merkle-proof', async (req: Request, res: Response) => {
    const result = ZkEVMDepositSchema.safeParse({ params: req.params, query: req.query });
    if (!result.success) {
      throw new BadRequest(result.error.issues[0]?.message ?? 'Invalid request');
    }

    const { network } = result.data.params;
    const { net_id, deposit_cnt } = result.data.query;

    const responseObj = await merkelProofGenerator(net_id, deposit_cnt, network, req.log);
    res.json(responseObj);
  });

  return router;
}
