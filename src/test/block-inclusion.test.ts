import { expect } from 'chai';
import { describe, it } from 'mocha';

import { getAgent } from './helpers/agent.ts';

const NON_EXISTANT_BLOCK_NUMBER = 999999999999999;

describe('block inclusion', function () {
  this.timeout(30000);

  it('should include block 1234', async function () {
    const res = await getAgent().get('/api/v1/matic/block-included/1234');

    expect(res).property('status', 200);
    expect(res).property('body').property('message', 'success');
    expect(res).property('body').property('headerBlockNumber', '0xea60');
  });

  it('should include amoy block 1234', async function () {
    const res = await getAgent().get('/api/v1/amoy/block-included/1234');

    expect(res).property('status', 200);
    expect(res).property('body').property('message', 'success');
    expect(res).property('body').property('headerBlockNumber', '0x9c40');
  });

  it(`should not include (return 404) for block ${NON_EXISTANT_BLOCK_NUMBER}`, async function () {
    const res = await getAgent().get(`/api/v1/matic/block-included/${NON_EXISTANT_BLOCK_NUMBER}`);

    expect(res).property('status', 404);
    expect(res).property('body').property('error', true);
  });

  it('should return 400 with correct message for a float block number', async function () {
    const res = await getAgent().get('/api/v1/matic/block-included/12324.56');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('msg', 'Invalid block number!');
  });

  it('should return 400 with correct message for a non-numeric block number', async function () {
    const res = await getAgent().get('/api/v1/matic/block-included/abc');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('msg', 'Invalid block number!');
  });
});
