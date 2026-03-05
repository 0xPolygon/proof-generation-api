import { describe, expect, it } from 'vitest';

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

describe('matic exit payload — ERC-1155', { timeout: 60_000 }, () => {
  it('erc1155 exit payload test', async () => {
    const res = await getAgent().get(
      '/api/v1/matic/exit-payload/0x4d4a9ee49a681a97ade92788f2fdce1d1761978ab491c2a10eb6849101cd63fe?eventSignature=0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb'
    );

    expect(res).property('status', 200);
    expect(res)
      .nested.property('body.result')
      .a('string')
      .match(/^0x[0-9a-f]+$/i);
    const result: string = res.body.result as string;

    const { receiptsRoot, receiptLogs } = decodeExitPayload(result);

    // receiptsRoot is the Polygon block's immutable receipts trie root.
    expect(receiptsRoot).equal(RECEIPTS_ROOT);

    // Find the TransferBatch-to-zero log that triggered this burn.
    // TransferBatch(operator, from, to indexed, ids, values) — to is topics[3].
    const burnLog = receiptLogs.find(
      (l) => l.topics[0] === TRANSFER_BATCH_SIG && l.topics[3]?.toLowerCase() === ZERO_ADDR
    );
    if (!burnLog) throw new Error('TransferBatch-to-zero log not found in decoded receipt');
    expect(burnLog).property('address').equal(ERC1155_CONTRACT);
    expect(burnLog).nested.property('topics[0]').equal(TRANSFER_BATCH_SIG);
    // operator and from are both the same address for this burn
    const operatorTopic = burnLog.topics[1];
    if (!operatorTopic) throw new Error('Operator topic missing');
    expect(operatorTopic.toLowerCase()).include(OPERATOR);
    expect(burnLog).nested.property('topics[3]').equal(ZERO_ADDR);
  });
});
