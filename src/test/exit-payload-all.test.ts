import { expect } from 'chai';
import { describe, it } from 'mocha';
import request from 'supertest';

import { getExpressApp } from '../index.ts';
import { decodeExitPayload } from './helpers/decode-exit-payload.ts';

const app = getExpressApp();

// Burn transaction: Polygon block 81892489, tx index 278
//   ERC-721 child contract: 0x9ab26d93aef3e78c3e220ecb20e769cbd07077c9
//   Single WithdrawnBatch (1 token burned)
//
// Immutable Polygon block data used as stable anchors (never changes regardless of RPC provider):
//   receiptsRoot: 0xf9210bbf1a1afa957c6b5cccafe518c670631affdf071e2dcf738cd83577dfc4
//   (verifiable on Polygonscan: block 81892489 → "Receipts Root" field)
const RECEIPTS_ROOT = '0xf9210bbf1a1afa957c6b5cccafe518c670631affdf071e2dcf738cd83577dfc4';

const ERC721_CONTRACT = '0x9ab26d93aef3e78c3e220ecb20e769cbd07077c9';
const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000000000000000000000000000';

describe('matic exit payload — all-exit-payloads', function () {
  this.timeout(60000);

  it('erc721 all exit payloads test', async function () {
    const res = await request(app).get(
      '/api/v1/matic/all-exit-payloads/0xdc3e4c2d41edd8c0a059be22aaa48ee6649f3688456db234b7e382e1cf735b50?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    );

    expect(res).property('status', 200);
    const result: string[] = res.body.result;
    expect(result).to.be.an('array').with.length(1);

    // Every payload in the result must encode the same burn receipt.
    for (const payload of result) {
      expect(payload).to.match(/^0x[0-9a-f]+$/i);

      const { receiptsRoot, receiptLogs } = decodeExitPayload(payload);

      // receiptsRoot is the Polygon block's immutable receipts trie root.
      expect(receiptsRoot).to.equal(RECEIPTS_ROOT);

      // Find the Transfer-to-zero log for this ERC-721 burn.
      // ERC-721 Transfer(from, to, tokenId) — all fields indexed, data is empty.
      const burnLog = receiptLogs.find(
        (l) => l.topics[0] === TRANSFER_SIG && l.topics[2]?.toLowerCase() === ZERO_ADDR
      );
      if (!burnLog) throw new Error('Transfer-to-zero log not found in decoded receipt');
      expect(burnLog.address).to.equal(ERC721_CONTRACT);
      expect(burnLog.topics[0]).to.equal(TRANSFER_SIG);
      expect(burnLog.topics[2]).to.equal(ZERO_ADDR);
    }
  });
});
