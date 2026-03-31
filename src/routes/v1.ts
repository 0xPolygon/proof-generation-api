import type { Request, Response } from 'express';

import { Router } from 'express';

import { BadRequest, GeneralError } from '@polygonlabs/verror';

import {
  AllExitPayloadsSchema,
  BlockIncludedSchema,
  ExitPayloadSchema,
  FastMerkleProofSchema
} from '../schemas.ts';
import {
  fastMerkleProof,
  generateAllExitPayloads,
  generateExitPayload,
  isBlockIncluded
} from '../services/v1ProofGenerationServices.ts';

const networkDetails = {
  matic: { version: 'v1' as const, isMainnet: true },
  amoy: { version: 'amoy' as const, isMainnet: false }
} as const;

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

export function createV1Router(): Router {
  const router = Router();

  router.get('/:network/block-included/:blockNumber', async (req: Request, res: Response) => {
    const result = BlockIncludedSchema.safeParse({ params: req.params, query: req.query });
    if (!result.success) {
      req.log.debug({ params: req.params }, result.error.issues[0]?.message ?? 'validation failed');
      throw new BadRequest(result.error.issues[0]?.message ?? 'Invalid request');
    }

    const { network, blockNumber } = result.data.params;
    const { version, isMainnet } = networkDetails[network];

    req.log.debug({ network, blockNumber }, 'block-included request');
    const responseObj = await isBlockIncluded(blockNumber, isMainnet, version, req.log);
    res.json(responseObj);
  });

  router.get('/:network/fast-merkle-proof', async (req: Request, res: Response) => {
    const result = FastMerkleProofSchema.safeParse({ params: req.params, query: req.query });
    if (!result.success) {
      throw new BadRequest(result.error.issues[0]?.message ?? 'Invalid request');
    }

    const { network } = result.data.params;
    const { start, end, number } = result.data.query;

    if (end < start || number > end || number < start) {
      throw new BadRequest('Invalid start or end or block numbers!');
    }

    const { version, isMainnet } = networkDetails[network];

    req.log.debug({ network, start, end, number }, 'fast-merkle-proof request');
    const responseObj = await fastMerkleProof(
      String(start),
      String(end),
      number,
      isMainnet,
      version,
      req.log
    );

    if (
      !responseObj?.proof ||
      !verifyMerkleProof(String(number), String(start), responseObj.proof)
    ) {
      throw new GeneralError('Invalid merkle proof created');
    }

    res.json(responseObj);
  });

  router.get('/:network/exit-payload/:burnTxHash', async (req: Request, res: Response) => {
    const result = ExitPayloadSchema.safeParse({ params: req.params, query: req.query });
    if (!result.success) {
      throw new BadRequest(result.error.issues[0]?.message ?? 'Invalid request');
    }

    const { network, burnTxHash } = result.data.params;
    const { eventSignature, tokenIndex } = result.data.query;
    const { version, isMainnet } = networkDetails[network];

    req.log.debug({ network, burnTxHash, eventSignature, tokenIndex }, 'exit-payload request');
    const responseObj = await generateExitPayload(
      burnTxHash,
      eventSignature,
      tokenIndex,
      isMainnet,
      version,
      req.log
    );
    res.json(responseObj);
  });

  router.get('/:network/all-exit-payloads/:burnTxHash', async (req: Request, res: Response) => {
    const result = AllExitPayloadsSchema.safeParse({ params: req.params, query: req.query });
    if (!result.success) {
      throw new BadRequest(result.error.issues[0]?.message ?? 'Invalid request');
    }

    const { network, burnTxHash } = result.data.params;
    const { eventSignature } = result.data.query;
    const { version, isMainnet } = networkDetails[network];

    req.log.debug({ network, burnTxHash, eventSignature }, 'all-exit-payloads request');
    const responseObj = await generateAllExitPayloads(
      burnTxHash,
      eventSignature,
      isMainnet,
      version,
      req.log
    );
    res.json(responseObj);
  });

  return router;
}
