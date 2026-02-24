import { expect } from 'chai';
import request from 'supertest';

import { getExpressApp } from '../index.ts';

const app = getExpressApp();

// Immutable data from the burn transaction receipt (Polygon chain, never changes):
//   ERC-1155 child contract:   0xf313982cc68cc8f432b2133e94bf536d8b7fcdc3
//   TransferBatch event topic: 0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb
//   Operator / from address:   0x28c9c1f5aece95f8676e1c11db2ab08aeef2308f
//
// The Ethereum receipts-trie Merkle path is NOT pinned — see exit-payload-erc20.test.ts.

describe('matic exit payload — ERC-1155', function () {
  this.timeout(60000);

  it('erc1155 exit payload test', async function () {
    const res = await request(app).get(
      '/api/v1/matic/exit-payload/0x4d4a9ee49a681a97ade92788f2fdce1d1761978ab491c2a10eb6849101cd63fe?eventSignature=0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb'
    );

    expect(res).property('status', 200);
    const result: string = res.body.result;
    expect(result).to.match(/^0x[0-9a-f]+$/i);
    expect(result.length).to.be.greaterThan(2000);
    // Burn tx receipt — immutable Polygon data:
    expect(result).to.include('f313982cc68cc8f432b2133e94bf536d8b7fcdc3'); // ERC-1155 contract
    expect(result).to.include('4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb'); // TransferBatch sig
    expect(result).to.include('28c9c1f5aece95f8676e1c11db2ab08aeef2308f'); // operator/from
  });
});
