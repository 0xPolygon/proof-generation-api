import { createRequire } from 'node:module';

import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi
} from '@asteasolutions/zod-to-openapi';
import { apiReference } from '@scalar/express-api-reference';
import { Router } from 'express';
import { z } from 'zod';

const { version } = createRequire(import.meta.url)('../../package.json') as { version: string };

import {
  AllExitPayloadsSchema,
  BlockIncludedSchema,
  ExitPayloadSchema,
  FastMerkleProofSchema,
  ZkEVMDepositSchema
} from '../schemas.ts';

// extendZodWithOpenApi is already called in schemas.ts; calling again is harmless
extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const SuccessSchema = z.object({ message: z.string() }).openapi('SuccessResponse');
const ErrorSchema = z.object({ error: z.literal(true), msg: z.string() }).openapi('ErrorResponse');
const NotFoundSchema = z
  .object({ error: z.literal(true), message: z.string() })
  .openapi('NotFoundResponse');

registry.registerPath({
  method: 'get',
  path: '/v1/{network}/block-included/{blockNumber}',
  summary: 'Check whether a Polygon block has been checkpointed to Ethereum',
  description:
    'Prerequisites gate for exit-payload: a block must be checkpointed before a proof can be generated. ' +
    'Poll this endpoint after a burn transaction until it returns 200, then call exit-payload.',
  request: {
    params: BlockIncludedSchema.shape.params,
    query: BlockIncludedSchema.shape.query
  },
  responses: {
    200: {
      description:
        'Block has been checkpointed — includes header block number, range, proposer, and root',
      content: { 'application/json': { schema: SuccessSchema } }
    },
    400: {
      description: 'Invalid parameters',
      content: { 'application/json': { schema: ErrorSchema } }
    },
    404: {
      description: 'Block not yet checkpointed to Ethereum',
      content: { 'application/json': { schema: NotFoundSchema } }
    }
  }
});

registry.registerPath({
  method: 'get',
  path: '/v1/{network}/fast-merkle-proof',
  summary: 'Get the block Merkle proof for a header block range',
  description:
    'Returns the Merkle proof for a block within a checkpoint header range using a minimal-RPC algorithm. ' +
    'Used as an intermediate step when constructing an exit payload manually.',
  request: {
    params: FastMerkleProofSchema.shape.params,
    query: FastMerkleProofSchema.shape.query
  },
  responses: {
    200: {
      description: 'Merkle proof hex string',
      content: {
        'application/json': {
          schema: z.object({ proof: z.string() }).openapi('MerkleProofResponse')
        }
      }
    },
    400: {
      description: 'Invalid parameters',
      content: { 'application/json': { schema: ErrorSchema } }
    }
  }
});

registry.registerPath({
  method: 'get',
  path: '/v1/{network}/exit-payload/{burnTxHash}',
  summary: 'Generate the exit payload for a PoS bridge burn transaction',
  description:
    'Returns the ABI-encoded payload to pass to the RootChainManager.exit() function on Ethereum. ' +
    'The block must already be checkpointed — call block-included first and poll until it returns 200.',
  request: {
    params: ExitPayloadSchema.shape.params,
    query: ExitPayloadSchema.shape.query
  },
  responses: {
    200: {
      description: 'ABI-encoded exit payload hex string',
      content: { 'application/json': { schema: SuccessSchema } }
    },
    400: {
      description: 'Invalid parameters',
      content: { 'application/json': { schema: ErrorSchema } }
    },
    404: {
      description:
        'No exit data found — block not yet checkpointed or burn transaction has no on-chain exit data',
      content: { 'application/json': { schema: NotFoundSchema } }
    }
  }
});

registry.registerPath({
  method: 'get',
  path: '/v1/{network}/all-exit-payloads/{burnTxHash}',
  summary: 'Generate exit payloads for all tokens in a burn transaction',
  description:
    'Returns an array of ABI-encoded exit payloads — one per token burned in the transaction. ' +
    'Use when a single burn transaction transfers multiple tokens.',
  request: {
    params: AllExitPayloadsSchema.shape.params,
    query: AllExitPayloadsSchema.shape.query
  },
  responses: {
    200: {
      description: 'Array of ABI-encoded exit payload hex strings',
      content: { 'application/json': { schema: SuccessSchema } }
    },
    400: {
      description: 'Invalid parameters',
      content: { 'application/json': { schema: ErrorSchema } }
    },
    404: {
      description:
        'No exit data found — block not yet checkpointed or burn transaction has no on-chain exit data',
      content: { 'application/json': { schema: NotFoundSchema } }
    }
  }
});

registry.registerPath({
  method: 'get',
  path: '/zkevm/{network}/bridge',
  summary: 'Fetch zkEVM bridge deposit data',
  description:
    'Proxies the zkEVM bridge API to retrieve deposit information. Does not compute proofs from chain data.',
  request: {
    params: ZkEVMDepositSchema.shape.params,
    query: ZkEVMDepositSchema.shape.query
  },
  responses: {
    200: {
      description: 'Bridge deposit data from the zkEVM bridge API',
      content: { 'application/json': { schema: SuccessSchema } }
    },
    400: {
      description: 'Invalid parameters',
      content: { 'application/json': { schema: ErrorSchema } }
    }
  }
});

registry.registerPath({
  method: 'get',
  path: '/zkevm/{network}/merkle-proof',
  summary: 'Fetch zkEVM Merkle proof for a deposit',
  description:
    'Proxies the zkEVM bridge API to retrieve the Merkle proof for a deposit. ' +
    'Does not compute proofs from chain data — the zkEVM bridge uses validity proofs, not the checkpoint mechanism used by PoS.',
  request: {
    params: ZkEVMDepositSchema.shape.params,
    query: ZkEVMDepositSchema.shape.query
  },
  responses: {
    200: {
      description: 'Merkle proof data from the zkEVM bridge API',
      content: {
        'application/json': {
          schema: z.object({ proof: z.object({}) }).openapi('ZkEVMMerkleProofResponse')
        }
      }
    },
    400: {
      description: 'Invalid parameters',
      content: { 'application/json': { schema: ErrorSchema } }
    }
  }
});

const spec = new OpenApiGeneratorV3(registry.definitions).generateDocument({
  openapi: '3.0.0',
  info: {
    title: 'Proof Generation API',
    version,
    description:
      'Backend service for Polygon bridge exit proof generation, consumed primarily by the Matic SDK.\n\n' +
      'The PoS bridge exit flow requires a cryptographic proof that a burn transaction was included in a ' +
      'checkpointed Polygon block. Generating this proof involves fetching the transaction receipt, ' +
      'constructing a Merkle proof of block inclusion, locating the correct checkpoint header, and encoding ' +
      'the result into the exact byte format the RootChainManager contract expects — too many sequential RPC ' +
      'calls to do reliably client-side. This service does that work server-side so the SDK makes a single HTTP request.\n\n' +
      'zkEVM endpoints proxy the zkEVM bridge API directly; they do not construct Merkle proofs from chain data.'
  },
  servers: [{ url: '/api' }]
});

const router = Router();

router.get('/openapi.json', (_req, res) => {
  res.json(spec);
});

router.use('/docs', apiReference({ content: spec }));

export { router as openApiRouter };
