/**
 * Regression — non-canonical encoding of `cumulativeGasUsed = 0`
 *
 * `getReceiptBytes` in `@maticnetwork/maticjs` used to wrap every receipt
 * field in `BufferUtil.toBuffer` before passing to `rlp.encode`. For an
 * integer field whose value is `0`, that produced `<Buffer 00>`, which
 * RLP-encodes to the single byte `0x00`. The canonical RLP encoding of
 * integer 0 is the empty byte string (`0x80`).
 *
 * Bor (go-ethereum) writes `receiptsRoot` using the canonical encoding,
 * so any exit proof derived from a Bor state-sync transaction (which
 * always has `cumulativeGasUsed = 0`) failed on-chain `MerklePatriciaProof.verify`
 * with `INVALID_RECEIPT_MERKLE_PROOF`. Fixed in matic.js#465 / 3.9.10.
 *
 * This test pins the bug case end-to-end through the API:
 *
 *   - Anchor: a real Bor state-sync receipt on Amoy block 37337056 (the
 *     same fixture matic.js's own unit test uses), tx
 *     `0x512dc8ec…`. The receipt has `type=0x7f`, `cumulativeGasUsed=0`,
 *     and 7 `LogTransfer` events from the system token.
 *   - The block's on-chain `receiptsRoot` is immutable
 *     (`0xb25e9efe…`) — verifiable on the Amoy explorer.
 *   - We fetch the exit-payload via the API for one of the in-receipt
 *     `LogTransfer` events, then assert (a) the embedded `receiptsRoot`
 *     matches the on-chain anchor and (b) the receipt bytes RLP-decode
 *     such that `cumulativeGasUsed` is the empty byte string (canonical),
 *     never the literal `0x00`.
 *
 * If matic.js ever regresses on the canonical encoding — or this service
 * accidentally pins to a buggy version — assertion (b) fails immediately
 * with a clear diff against `0x80`.
 */

import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';

import { getAgent } from './helpers/agent.ts';
import { decodeExitPayload } from './helpers/decode-exit-payload.ts';

// Amoy block 37337056, tx index 0 — a single Bor state-sync transaction
// with type=0x7f, cumulativeGasUsed=0, and 7 LogTransfer logs from the
// child gas token (0x...1010).
const STATE_SYNC_TX = '0x512dc8ec81bd8d41c163396cab01c9320e9ff67947189065038ea7b94cb66e89';

// `LogTransfer(address,address,address,uint256,uint256,uint256,uint256,uint256)` —
// emitted by the Bor child gas token on every state-sync. Picked as the
// event signature because it's reliably present in the receipt; the
// bridge-validity of the resulting proof is irrelevant here, only the
// canonical encoding of the receipt bytes is.
const LOG_TRANSFER_SIG = '0xe6497e3ee548a3372136af2fcb0696db31fc6cf20260707645068bd3fe97f3c4';

// Immutable on-chain anchor for the block. Verifiable on Amoy explorer:
// block 37337056 → "Receipts Root" field. Pinning this guards against
// any encoding regression *anywhere* in the receipt — the trie root
// derives from the keccak of the encoded receipt, so a single
// non-canonical byte produces a different root.
const RECEIPTS_ROOT = '0xb25e9efe7b0a26e11f8927e2c85f57e62e195136270225c7d1f4a129bf3f475c';

describe('amoy exit payload — Bor state-sync receipt regression', { timeout: 60_000 }, () => {
  it('encodes cumulativeGasUsed=0 as the canonical empty byte string (not 0x00)', async () => {
    const res = await getAgent().get(
      `/api/v1/amoy/exit-payload/${STATE_SYNC_TX}?eventSignature=${LOG_TRANSFER_SIG}`
    );

    expect(res).property('status', 200);
    expect(res).nested.property('body.result').a('string');

    const result = res.body.result as string;
    expect(result).match(/^0x[0-9a-f]+$/i);

    // Strong end-to-end check: the embedded receiptsRoot must equal the
    // on-chain anchor. If any byte of the encoded receipt is wrong, the
    // trie root mismatches and this fails before we even decode.
    const { receiptsRoot } = decodeExitPayload(result);
    expect(receiptsRoot).equal(RECEIPTS_ROOT);

    // Specific check on the cumulativeGasUsed encoding. Decode field [6]
    // (receipt bytes), strip the EIP-2718 type prefix if present, then
    // RLP-decode into [status, cumulativeGasUsed, logsBloom, logs[]].
    const fields = ethers.utils.RLP.decode(result) as string[];
    let receiptHex = fields[6] as string;
    if (parseInt(receiptHex.slice(2, 4), 16) < 0x80) receiptHex = '0x' + receiptHex.slice(4);
    const decoded = ethers.utils.RLP.decode(receiptHex as `0x${string}`) as string[];

    // Canonical RLP of integer 0 is the empty byte string. ethers' RLP
    // decoder returns it as the literal string '0x' (zero data bytes).
    // The buggy encoding returns '0x00' (one data byte).
    expect(decoded[1], 'cumulativeGasUsed must be canonical empty bytes (0x), never 0x00').equal(
      '0x'
    );
  });
});
