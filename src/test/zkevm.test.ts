import { describe, expect, it } from 'vitest';

import { getAgent } from './helpers/agent.ts';

describe('zkEVM endpoints', { timeout: 30_000 }, () => {
  it('zkEVM mainnet bridge — deposit lookup', async () => {
    const res = await getAgent().get('/api/zkevm/mainnet/bridge?net_id=1&deposit_cnt=1');

    expect(res).property('status', 200);
    expect(res).nested.property('body.deposit');
    expect(res).nested.property(
      'body.deposit.tx_hash',
      '0xb07cd0b30019c78c0b60e464c7c38a0a8076a355dbe9177205573e86455f31b6'
    );
    expect(res).nested.property('body.deposit.deposit_cnt', 1);
    expect(res).nested.property('body.deposit.ready_for_claim', true);
  });

  it('zkEVM mainnet merkle-proof — deposit lookup', async () => {
    const res = await getAgent().get('/api/zkevm/mainnet/merkle-proof?net_id=1&deposit_cnt=1');

    expect(res).property('status', 200);
    expect(res).nested.property('body.proof');
    expect(res).nested.property('body.proof.merkle_proof').length.greaterThan(0);
    expect(res).nested.property('body.proof.rollup_merkle_proof');
  });

  it('should 400 with correct message for invalid network on zkEVM bridge', async () => {
    const res = await getAgent().get('/api/zkevm/polygon/bridge?net_id=1&deposit_cnt=1');

    expect(res).property('status', 400);
    expect(res).nested.property('body.error', true);
    expect(res).nested.property(
      'body.message',
      'Invalid network polygon. Network can either be mainnet, testnet, cherry or cardona for zkEVM routes'
    );
  });

  it('should 400 with correct message for invalid network on zkEVM merkle-proof', async () => {
    const res = await getAgent().get('/api/zkevm/polygon/merkle-proof?net_id=1&deposit_cnt=1');

    expect(res).property('status', 400);
    expect(res).nested.property('body.error', true);
    expect(res).nested.property(
      'body.message',
      'Invalid network polygon. Network can either be mainnet, testnet, cherry or cardona for zkEVM routes'
    );
  });

  it('should 400 with correct message for non-integer deposit_cnt', async () => {
    const res = await getAgent().get('/api/zkevm/mainnet/merkle-proof?net_id=1&deposit_cnt=abc');

    expect(res).property('status', 400);
    expect(res).nested.property('body.error', true);
    expect(res).nested.property('body.message', 'Invalid network ID or deposit count!');
  });

  it('should 400 with correct message for float deposit_cnt', async () => {
    const res = await getAgent().get('/api/zkevm/mainnet/bridge?net_id=1&deposit_cnt=1.5');

    expect(res).property('status', 400);
    expect(res).nested.property('body.error', true);
    expect(res).nested.property('body.message', 'Invalid network ID or deposit count!');
  });

  it('should 400 with correct message for non-integer net_id', async () => {
    const res = await getAgent().get('/api/zkevm/mainnet/bridge?net_id=abc&deposit_cnt=1');

    expect(res).property('status', 400);
    expect(res).nested.property('body.error', true);
    expect(res).nested.property('body.message', 'Invalid network ID or deposit count!');
  });
});
