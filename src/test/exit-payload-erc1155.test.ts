import { expect } from 'chai';
import { describe, it } from 'mocha';

import { getAgent } from './helpers/agent.ts';
import { decodeExitPayload } from './helpers/decode-exit-payload.ts';

// Burn transaction: Polygon block 18113528, tx index 27
//   ERC-1155 child contract: 0xf313982cc68cc8f432b2133e94bf536d8b7fcdc3
//   Operator/from: 0x28c9c1f5aece95f8676e1c11db2ab08aeef2308f
//
// Immutable Polygon block data used as stable anchors (never changes regardless of RPC provider):
//   receiptsRoot: 0xeb24486054aa8c0cc925c91bf3f32e983125c8e67f7e615d25aba530fd8c6deb
//   (verifiable on Polygonscan: block 18113528 → "Receipts Root" field)
const RECEIPTS_ROOT = '0xeb24486054aa8c0cc925c91bf3f32e983125c8e67f7e615d25aba530fd8c6deb';

const ERC1155_CONTRACT = '0xf313982cc68cc8f432b2133e94bf536d8b7fcdc3';
const TRANSFER_BATCH_SIG = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000000000000000000000000000';
const OPERATOR = '28c9c1f5aece95f8676e1c11db2ab08aeef2308f';

describe('matic exit payload — ERC-1155', function () {
  this.timeout(60000);

  it('erc1155 exit payload test', async function () {
    const res = await getAgent().get(
      '/api/v1/matic/exit-payload/0x4d4a9ee49a681a97ade92788f2fdce1d1761978ab491c2a10eb6849101cd63fe?eventSignature=0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb'
    );

    expect(res).property('status', 200);
    const result: string = res.body.result;
    expect(result).to.match(/^0x[0-9a-f]+$/i);

    const { receiptsRoot, receiptLogs } = decodeExitPayload(result);

    // receiptsRoot is the Polygon block's immutable receipts trie root.
    expect(receiptsRoot).to.equal(RECEIPTS_ROOT);

    // Find the TransferBatch-to-zero log that triggered this burn.
    // TransferBatch(operator, from, to indexed, ids, values) — to is topics[3].
    const burnLog = receiptLogs.find(
      (l) => l.topics[0] === TRANSFER_BATCH_SIG && l.topics[3]?.toLowerCase() === ZERO_ADDR
    );
    if (!burnLog) throw new Error('TransferBatch-to-zero log not found in decoded receipt');
    expect(burnLog.address).to.equal(ERC1155_CONTRACT);
    expect(burnLog.topics[0]).to.equal(TRANSFER_BATCH_SIG);
    // operator and from are both the same address for this burn
    expect(burnLog.topics[1]!.toLowerCase()).to.include(OPERATOR);
    expect(burnLog.topics[3]).to.equal(ZERO_ADDR);
  });
});
