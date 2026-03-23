import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi
} from '@asteasolutions/zod-to-openapi';
import { apiReference } from '@scalar/express-api-reference';
import { Router } from 'express';
import { z } from 'zod';

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
  summary: 'Check if a block is included in the PoS chain',
  request: {
    params: BlockIncludedSchema.shape.params,
    query: BlockIncludedSchema.shape.query
  },
  responses: {
    200: {
      description: 'Block is included',
      content: { 'application/json': { schema: SuccessSchema } }
    },
    400: {
      description: 'Invalid parameters',
      content: { 'application/json': { schema: ErrorSchema } }
    },
    404: {
      description: 'Block not found',
      content: { 'application/json': { schema: NotFoundSchema } }
    }
  }
});

registry.registerPath({
  method: 'get',
  path: '/v1/{network}/fast-merkle-proof',
  summary: 'Generate a fast Merkle proof for a block range',
  request: {
    params: FastMerkleProofSchema.shape.params,
    query: FastMerkleProofSchema.shape.query
  },
  responses: {
    200: {
      description: 'Merkle proof result',
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
  summary: 'Generate exit payload for a burn transaction',
  request: {
    params: ExitPayloadSchema.shape.params,
    query: ExitPayloadSchema.shape.query
  },
  responses: {
    200: {
      description: 'Exit payload',
      content: { 'application/json': { schema: SuccessSchema } }
    },
    400: {
      description: 'Invalid parameters',
      content: { 'application/json': { schema: ErrorSchema } }
    },
    404: {
      description: 'Transaction not found',
      content: { 'application/json': { schema: NotFoundSchema } }
    }
  }
});

registry.registerPath({
  method: 'get',
  path: '/v1/{network}/all-exit-payloads/{burnTxHash}',
  summary: 'Generate all exit payloads for a burn transaction',
  request: {
    params: AllExitPayloadsSchema.shape.params,
    query: AllExitPayloadsSchema.shape.query
  },
  responses: {
    200: {
      description: 'All exit payloads',
      content: { 'application/json': { schema: SuccessSchema } }
    },
    400: {
      description: 'Invalid parameters',
      content: { 'application/json': { schema: ErrorSchema } }
    },
    404: {
      description: 'Transaction not found',
      content: { 'application/json': { schema: NotFoundSchema } }
    }
  }
});

registry.registerPath({
  method: 'get',
  path: '/zkevm/{network}/bridge',
  summary: 'Look up a zkEVM bridge deposit',
  request: {
    params: ZkEVMDepositSchema.shape.params,
    query: ZkEVMDepositSchema.shape.query
  },
  responses: {
    200: {
      description: 'Bridge deposit data',
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
  summary: 'Generate a zkEVM Merkle proof for a deposit',
  request: {
    params: ZkEVMDepositSchema.shape.params,
    query: ZkEVMDepositSchema.shape.query
  },
  responses: {
    200: {
      description: 'Merkle proof data',
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
    version: '1.0.0',
    description: 'Merkle proof generation and block inclusion checks for the Matic SDK'
  },
  servers: [{ url: '/api' }]
});

const router = Router();

router.get('/openapi.json', (_req, res) => {
  res.json(spec);
});

router.use('/docs', apiReference({ content: spec }));

export { router as openApiRouter };
