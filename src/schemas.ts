import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

// Shared primitives

const HexBytes32Schema = z
  .string({ error: () => 'Invalid burnTxHash or eventSignature!' })
  .min(1, { message: 'Invalid burnTxHash or eventSignature!' })
  .regex(/^0x[0-9a-fA-F]{64}$/, { message: 'Incorrect Burn tx or Event Signature!' });

const V1NetworkSchema = z.enum(['matic', 'amoy'] as const, {
  error: (issue) =>
    `Invalid network ${String(issue.input)}. Network can either be matic or amoy for PoS v1 routes`
});

// Request schemas — each wraps { params, query } so a single safeParse covers both

export const BlockIncludedSchema = z.object({
  params: z.object({
    blockNumber: z
      .string()
      .regex(/^\d+$/, { message: 'Invalid block number!' })
      .openapi({ description: 'Block number to check inclusion for' }),
    network: V1NetworkSchema.openapi({ description: 'PoS network identifier' })
  }),
  query: z.object({})
});

// The checkpoint merkle tree is at most 16 levels deep, so a block range can span at most
// 2^16 blocks; a wider range can never yield a proof, whichever RPC is asked.
export const MAX_BLOCK_RANGE = 2 ** 16;

export const FastMerkleProofSchema = z.object({
  params: z.object({
    network: V1NetworkSchema.openapi({ description: 'PoS network identifier' })
  }),
  query: z
    .object({
      start: z.coerce
        .number({ error: () => 'Invalid start, end or block number!' })
        .int({ message: 'Invalid start, end or block number!' })
        .nonnegative({ message: 'Invalid start, end or block number!' })
        .openapi({ description: 'Start block number' }),
      end: z.coerce
        .number({ error: () => 'Invalid start, end or block number!' })
        .int({ message: 'Invalid start, end or block number!' })
        .nonnegative({ message: 'Invalid start, end or block number!' })
        .openapi({ description: 'End block number' }),
      number: z.coerce
        .number({ error: () => 'Invalid start, end or block number!' })
        .int({ message: 'Invalid start, end or block number!' })
        .nonnegative({ message: 'Invalid start, end or block number!' })
        .openapi({ description: 'Target block number' })
    })
    .superRefine((query, ctx) => {
      if (query.end - query.start + 1 > MAX_BLOCK_RANGE) {
        ctx.addIssue({
          code: 'custom',
          message: `Block range too large: end - start + 1 must be at most ${MAX_BLOCK_RANGE}`
        });
      }
    })
});

export const ExitPayloadSchema = z.object({
  params: z.object({
    burnTxHash: HexBytes32Schema.openapi({ description: 'Burn transaction hash (0x + 64 hex)' }),
    network: V1NetworkSchema.openapi({ description: 'PoS network identifier' })
  }),
  query: z.object({
    eventSignature: HexBytes32Schema.openapi({ description: 'Event signature hash (0x + 64 hex)' }),
    tokenIndex: z.coerce
      .number({ error: () => 'Invalid token index' })
      .int()
      .nonnegative()
      .default(0)
      .openapi({ description: 'Token index (default 0)' })
  })
});

export const AllExitPayloadsSchema = z.object({
  params: z.object({
    burnTxHash: HexBytes32Schema.openapi({ description: 'Burn transaction hash (0x + 64 hex)' }),
    network: V1NetworkSchema.openapi({ description: 'PoS network identifier' })
  }),
  query: z.object({
    eventSignature: HexBytes32Schema.openapi({ description: 'Event signature hash (0x + 64 hex)' })
  })
});
