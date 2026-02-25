import { expect } from 'chai';
import { describe, it } from 'mocha';
import request from 'supertest';

import { getExpressApp } from '../index.ts';

const app = getExpressApp();
const NON_EXISTANT_BLOCK_NUMBER = 999999999999999;

describe('block inclusion', function () {
  this.timeout(30000);

  it('should include block 1234', async function () {
    const res = await request(app).get('/api/v1/matic/block-included/1234');

    expect(res).property('status', 200);
    expect(res).property('body').property('message', 'success');
    expect(res).property('body').property('headerBlockNumber', '0xea60');
  });

  it('should include amoy block 1234', async function () {
    const res = await request(app).get('/api/v1/amoy/block-included/1234');

    expect(res).property('status', 200);
    expect(res).property('body').property('message', 'success');
    expect(res).property('body').property('headerBlockNumber', '0x9c40');
  });

  it(`should not include (return 404) for block ${NON_EXISTANT_BLOCK_NUMBER}`, async function () {
    const res = await request(app).get(`/api/v1/matic/block-included/${NON_EXISTANT_BLOCK_NUMBER}`);

    expect(res).property('status', 404);
    expect(res).property('body').property('error', true);
  });

  it('should return error 400 if given a malformed (float) block number', async function () {
    const res = await request(app).get('/api/v1/matic/block-included/12324.56');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
  });
});
