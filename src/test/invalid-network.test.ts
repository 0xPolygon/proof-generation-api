import { describe, expect, it } from 'vitest';

import { getAgent } from './helpers/agent.ts';

const VALID_BURN_TX = '0x1a7b6aba7e51344474d4fe722a3969e8c7a863c72329210a0dda80d26c4234b4';
const VALID_EVENT_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

describe('invalid network param tests', () => {
  it('should 400 for `mainnet` on v1 block-included — msg contains network name', async () => {
    const res = await getAgent().get('/api/v1/mainnet/block-included/3000000');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res)
      .property('body')
      .property(
        'msg',
        'Invalid network mainnet. Network can either be matic or amoy for PoS v1 routes'
      );
  });

  it('should 400 for `testnet` on v1 fast-merkle-proof — msg contains network name', async () => {
    const res = await getAgent().get(
      '/api/v1/testnet/fast-merkle-proof?start=12345&end=12347&number=12346'
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res)
      .property('body')
      .property(
        'msg',
        'Invalid network testnet. Network can either be matic or amoy for PoS v1 routes'
      );
  });

  it('should 400 for `mum` on v1 exit-payload — msg contains network name', async () => {
    const res = await getAgent().get(
      `/api/v1/mum/exit-payload/${VALID_BURN_TX}?eventSignature=${VALID_EVENT_SIG}`
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res)
      .property('body')
      .property(
        'msg',
        'Invalid network mum. Network can either be matic or amoy for PoS v1 routes'
      );
  });

  it('should 400 for `mainnet` on v1 all-exit-payloads — msg contains network name', async () => {
    const res = await getAgent().get(
      `/api/v1/mainnet/all-exit-payloads/${VALID_BURN_TX}?eventSignature=${VALID_EVENT_SIG}`
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res)
      .property('body')
      .property(
        'msg',
        'Invalid network mainnet. Network can either be matic or amoy for PoS v1 routes'
      );
  });

  it('should 400 for `polygon` on zkEVM bridge — msg contains network name', async () => {
    const res = await getAgent().get('/api/zkevm/polygon/bridge?net_id=1&deposit_cnt=1');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res)
      .property('body')
      .property(
        'msg',
        'Invalid network polygon. Network can either be mainnet, testnet, cherry or cardona for zkEVM routes'
      );
  });

  it('should 400 for `polygon` on zkEVM merkle-proof — msg contains network name', async () => {
    const res = await getAgent().get('/api/zkevm/polygon/merkle-proof?net_id=1&deposit_cnt=1');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res)
      .property('body')
      .property(
        'msg',
        'Invalid network polygon. Network can either be mainnet, testnet, cherry or cardona for zkEVM routes'
      );
  });
});
