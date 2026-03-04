import { describe, expect, it } from 'vitest';

import { getAgent } from './helpers/agent.ts';
import { decodeExitPayload } from './helpers/decode-exit-payload.ts';

// Burn transaction: Polygon block 11619491, tx index 0
//   WETH child contract: 0xb6509cbd9e2d1cec787a7357eb1578b86a0c702d
//   Burned 10 WETH (0x8ac7230489e80000)
//
// Immutable Polygon block data used as stable anchors (never changes regardless of RPC provider):
//   receiptsRoot: 0xc37362a665ea9596ce130e50ba31f673672dfc7e946870c1cbb20884269e5d4f
//   (verifiable on Polygonscan: block 11619491 → "Receipts Root" field)
const RECEIPTS_ROOT = '0xc37362a665ea9596ce130e50ba31f673672dfc7e946870c1cbb20884269e5d4f';

const WETH_CONTRACT = '0xb6509cbd9e2d1cec787a7357eb1578b86a0c702d';
const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000000000000000000000000000';
const AMOUNT_10_WETH = '8ac7230489e80000';

function assertErc20Payload(result: string) {
  expect(result).match(/^0x[0-9a-f]+$/i);

  const { receiptsRoot, receiptLogs } = decodeExitPayload(result);

  // receiptsRoot is the Polygon block's immutable receipts trie root — stable
  // across all RPC providers and forever pinnable from block explorer data.
  expect(receiptsRoot).equal(RECEIPTS_ROOT);

  // Find the Transfer-to-zero log that triggered this burn.
  const burnLog = receiptLogs.find(
    (l) => l.topics[0] === TRANSFER_SIG && l.topics[2]?.toLowerCase() === ZERO_ADDR
  );
  if (!burnLog) throw new Error('Transfer-to-zero log not found in decoded receipt');
  expect(burnLog.address).equal(WETH_CONTRACT);
  expect(burnLog.topics[0]).equal(TRANSFER_SIG);
  expect(burnLog.topics[2]).equal(ZERO_ADDR);
  // Transfer(from, to, value) — value is ABI-encoded in data as a uint256
  expect(burnLog.data.toLowerCase()).include(AMOUNT_10_WETH);
}

describe('matic exit payload — ERC-20', { timeout: 60_000 }, () => {
  it('exit payload test', async () => {
    const res = await getAgent().get(
      '/api/v1/matic/exit-payload/0x1a7b6aba7e51344474d4fe722a3969e8c7a863c72329210a0dda80d26c4234b4?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    );

    expect(res).property('status', 200);
    assertErc20Payload(res.body.result);
  });

  it('exit payload with tokenIndex argument test', async () => {
    const res = await getAgent().get(
      '/api/v1/matic/exit-payload/0x1a7b6aba7e51344474d4fe722a3969e8c7a863c72329210a0dda80d26c4234b4?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef&tokenIndex=0'
    );

    expect(res).property('status', 200);
    assertErc20Payload(res.body.result);
  });
});
