import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MerkleTreeDepthExceededError,
  MerkleTreeRequiresLeavesError,
  ProofBuildError
} from '@polygonlabs/maticjs';

import type { Logger } from '../logger.ts';

import { FastMerkleProofSchema, MAX_BLOCK_RANGE } from '../schemas.ts';
import { fastMerkleProof } from '../services/v1ProofGenerationServices.ts';

const mocks = vi.hoisted(() => ({
  RPC_COUNT: 2,
  getBlockProof: vi.fn()
}));

vi.mock('../config.ts', () => {
  const urls = Array.from({ length: mocks.RPC_COUNT }, (_, i) => `http://rpc-${i}.invalid`);
  return {
    config: {
      app: { ethereumRPC: urls, sepoliaRPC: urls, maticRPC: urls, amoyRPC: urls },
      mainnetRpcIndex: 0,
      testnetRpcIndex: 0
    }
  };
});

vi.mock('../maticClient.ts', () => ({
  initMatic: vi.fn(() => Promise.resolve({ pos: { getBlockProof: mocks.getBlockProof } }))
}));

const logger = { warn: vi.fn() } as unknown as Logger;

const parse = ({ start, end, number }: { start: string; end: string; number: string }) =>
  FastMerkleProofSchema.safeParse({
    params: { network: 'matic' },
    query: { start, end, number }
  });

describe('fast-merkle-proof block range limit', () => {
  it('allows a range of exactly 2^16 blocks', () => {
    const result = parse({ start: '0', end: String(MAX_BLOCK_RANGE - 1), number: '1' });

    expect(result).property('success', true);
  });

  it('refuses a range of 2^16 + 1 blocks naming the limit', () => {
    const result = parse({ start: '0', end: String(MAX_BLOCK_RANGE), number: '1' });

    expect(result).property('success', false);
    expect(result).nested.property(
      'error.issues[0].message',
      'Block range too large: end - start + 1 must be at most 65536'
    );
  });
});

describe('fastMerkleProof refusals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('answers 400 after one attempt when the SDK reports the tree too deep', async () => {
    mocks.getBlockProof.mockRejectedValue(
      new ProofBuildError({
        info: { operation: 'getBlockProof', mode: 'read' },
        cause: new MerkleTreeDepthExceededError('block range needs a merkle path deeper than 16', {
          info: { depth: 17 }
        })
      })
    );

    const err = await fastMerkleProof('1', '100000', 50000, true, 'v1', logger).catch(
      (e: unknown) => e
    );

    expect(err).property('statusCode', 400);
    expect(err).property('message', 'Block range too large: end - start + 1 must be at most 65536');
    expect(mocks.getBlockProof).toHaveBeenCalledTimes(1);
  });

  it('keeps retrying other failures on every endpoint', async () => {
    mocks.getBlockProof.mockRejectedValue(
      new ProofBuildError({
        info: { operation: 'getBlockProof', mode: 'read' },
        cause: new MerkleTreeRequiresLeavesError('At least 1 leaf required')
      })
    );

    const err = await fastMerkleProof('1', '10', 5, true, 'v1', logger).catch((e: unknown) => e);

    expect(err).instanceOf(ProofBuildError);
    expect(mocks.getBlockProof).toHaveBeenCalledTimes(2 * mocks.RPC_COUNT);
  });
});
