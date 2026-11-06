import { describe, expect, it } from 'vitest';

import { getAgent } from './helpers/agent.ts';

const NON_EXISTANT_BLOCK_NUMBER = 999999999999999;

describe('block inclusion', { timeout: 30_000 }, () => {
  it('should include block 1234', async () => {
    const res = await getAgent().get('/api/v1/matic/block-included/1234');

    expect(res).property('status', 200);
    expect(res).property('body').property('message', 'success');
    expect(res).property('body').property('headerBlockNumber', '0xea60');
  });

  it('keeps the ethers BigNumber JSON shape for the header fields of block 1234', async () => {
    // Consumers parse these fields as `{ type: 'BigNumber', hex }`; the SDK moving
    // to bigint must not change the wire shape. Header block 0xea60 is immutable.
    const res = await getAgent().get('/api/v1/matic/block-included/1234');

    expect(res).property('status', 200);
    expect(res)
      .property('body')
      .deep.equal({
        headerBlockNumber: '0xea60',
        blockNumber: '1234',
        start: { type: 'BigNumber', hex: '0x048a' },
        end: { type: 'BigNumber', hex: '0x0589' },
        proposer: '0xb8bB158B93c94ed35c1970D610d1E2B34E26652c',
        root: '0xb22c1f7f92d2b24c23eed54ed3d3ade539978aeb83e16fc1b2154538820be502',
        createdAt: { type: 'BigNumber', hex: '0x5ed29623' },
        message: 'success'
      });
  });

  it('should include amoy block 1234', async () => {
    const res = await getAgent().get('/api/v1/amoy/block-included/1234');

    expect(res).property('status', 200);
    expect(res).property('body').property('message', 'success');
    expect(res).property('body').property('headerBlockNumber', '0x9c40');
  });

  it(`should not include (return 404) for block ${NON_EXISTANT_BLOCK_NUMBER}`, async () => {
    const res = await getAgent().get(`/api/v1/matic/block-included/${NON_EXISTANT_BLOCK_NUMBER}`);

    expect(res).property('status', 404);
    expect(res).property('body').property('error', true);
  });

  it('should return 400 with correct message for a float block number', async () => {
    const res = await getAgent().get('/api/v1/matic/block-included/12324.56');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('message', 'Invalid block number!');
  });

  it('should return 400 with correct message for a non-numeric block number', async () => {
    const res = await getAgent().get('/api/v1/matic/block-included/abc');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('message', 'Invalid block number!');
  });
});
