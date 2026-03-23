import type { Response, Request } from 'express';

import { Router } from 'express';

import { InfoError } from '../helpers/errorHelper.ts';
import { handleBadRequest, handleError, handleResponse } from '../helpers/responseHandlers.ts';
import { getLogger } from '../logger.ts';
import {
  AllExitPayloadsSchema,
  BlockIncludedSchema,
  ExitPayloadSchema,
  FastMerkleProofSchema
} from '../schemas.ts';
import {
  isBlockIncluded,
  fastMerkleProof,
  generateExitPayload,
  generateAllExitPayloads
} from '../services/v1ProofGenerationServices.ts';

let _logger: ReturnType<typeof getLogger> | undefined;
const logger = new Proxy({} as ReturnType<typeof getLogger>, {
  get: (_, key) => Reflect.get((_logger ??= getLogger()), key as PropertyKey)
});
const router = Router();

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

router.get('/:network/block-included/:blockNumber', async (req: Request, res: Response) => {
  try {
    const result = BlockIncludedSchema.safeParse({ params: req.params, query: req.query });
    if (!result.success) {
      logger.debug({ message: result.error.issues[0]?.message, params: req.params });
      return handleBadRequest({
        res,
        errMsg: result.error.issues[0]?.message ?? 'Invalid request'
      });
    }

    const { network, blockNumber } = result.data.params;
    const { version, isMainnet } = networkDetails[network];

    const responseObj = await isBlockIncluded(blockNumber, isMainnet, version);
    return handleResponse({ res, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ res, statusCode: 404, err: error });
    }
    logger.error({ message: 'error in isBlockIncluded route', error });
    return handleError({ res });
  }
});

router.get('/:network/fast-merkle-proof', async (req: Request, res: Response) => {
  try {
    const result = FastMerkleProofSchema.safeParse({ params: req.params, query: req.query });
    if (!result.success) {
      return handleBadRequest({
        res,
        errMsg: result.error.issues[0]?.message ?? 'Invalid request'
      });
    }

    const { network } = result.data.params;
    const { start, end, number } = result.data.query;

    if (end < start || number > end || number < start) {
      return handleBadRequest({
        res,
        errMsg: 'Invalid start or end or block numbers!'
      });
    }

    const { version, isMainnet } = networkDetails[network];

    const responseObj = await fastMerkleProof(
      String(start),
      String(end),
      number,
      isMainnet,
      version
    );

    if (
      !responseObj ||
      !responseObj.proof ||
      !verifyMerkleProof(String(number), String(start), responseObj.proof)
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

router.get('/:network/exit-payload/:burnTxHash', async (req: Request, res: Response) => {
  try {
    const result = ExitPayloadSchema.safeParse({ params: req.params, query: req.query });
    if (!result.success) {
      return handleBadRequest({
        res,
        errMsg: result.error.issues[0]?.message ?? 'Invalid request'
      });
    }

    const { network, burnTxHash } = result.data.params;
    const { eventSignature, tokenIndex } = result.data.query;
    const { version, isMainnet } = networkDetails[network];

    const responseObj = await generateExitPayload(
      burnTxHash,
      eventSignature,
      tokenIndex,
      isMainnet,
      version
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

router.get('/:network/all-exit-payloads/:burnTxHash', async (req: Request, res: Response) => {
  try {
    const result = AllExitPayloadsSchema.safeParse({ params: req.params, query: req.query });
    if (!result.success) {
      return handleBadRequest({
        res,
        errMsg: result.error.issues[0]?.message ?? 'Invalid request'
      });
    }

    const { network, burnTxHash } = result.data.params;
    const { eventSignature } = result.data.query;
    const { version, isMainnet } = networkDetails[network];

    const responseObj = await generateAllExitPayloads(
      burnTxHash,
      eventSignature,
      isMainnet,
      version
    );

    return handleResponse({ res, data: responseObj });
  } catch (error) {
    if (error instanceof InfoError) {
      return handleError({ res, statusCode: 404, err: error });
    }
    logger.error({ message: 'error in allExitPayloads route', error });
    return handleError({ res });
  }
});

export { router as v1Routes };
