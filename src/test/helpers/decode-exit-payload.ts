import { ethers } from 'ethers';

export interface ExitPayloadLog {
  address: string; // 0x-prefixed, lowercase
  topics: string[]; // 0x-prefixed hex, one entry per topic
  data: string; // 0x-prefixed hex
}

export interface DecodedExitPayload {
  receiptsRoot: string; // 0x-prefixed hex, 32 bytes — the Polygon block's receipts trie root
  receiptLogs: ExitPayloadLog[];
}

/**
 * Decodes the RLP-encoded exit payload produced by ExitUtil.encodePayload_ in
 * @maticnetwork/maticjs's exit_util.ts.
 *
 * Outer RLP structure — 10 fields (see runbook §"Exit payload field reference"):
 *
 *   [0] headerNumber      – Ethereum checkpoint index                 (immutable)
 *   [1] blockProof        – Merkle proof of Polygon block in checkpoint (immutable for old txs)
 *   [2] blockNumber       – Polygon block number                       (immutable)
 *   [3] timestamp         – Polygon block timestamp                    (immutable)
 *   [4] transactionsRoot  – Polygon block transactionsRoot             (immutable)
 *   [5] receiptsRoot      – Polygon block receiptsRoot                 (immutable) ← pinned
 *   [6] receipt           – RLP-encoded burn tx receipt                (immutable) ← decoded
 *   [7] parentNodes       – Patricia trie proof nodes
 *   [8] path              – RLP(transactionIndex) prefixed with 0x00
 *   [9] logIndex          – index of the matched event in the receipt
 */
export function decodeExitPayload(hex: string): DecodedExitPayload {
  // Outer RLP decode — each leaf is a 0x-prefixed hex string
  const fields = ethers.utils.RLP.decode(hex) as string[];

  const receiptsRoot = fields[5] as string;

  // Field [6] contains the raw receipt bytes.
  // For EIP-2718 typed receipts (type 0x01 or 0x02), the first byte is the
  // type indicator and is not part of the RLP structure — strip it before decoding.
  // Untyped (legacy) receipts are plain RLP lists and start at >= 0xc0.
  let receiptHex = fields[6] as string;
  const firstByte = parseInt(receiptHex.slice(2, 4), 16);
  if (firstByte < 0x80) {
    receiptHex = '0x' + receiptHex.slice(4);
  }

  // Inner RLP: [status, cumulativeGasUsed, logsBloom, logs[]]
  // Each log entry: [address, [topic0, topic1, ...], data]
  type RawLog = [string, string[], string];
  const receiptDecoded = ethers.utils.RLP.decode(receiptHex as `0x${string}`) as unknown[];
  const logsRaw = receiptDecoded[3] as RawLog[];

  const receiptLogs: ExitPayloadLog[] = logsRaw.map(([address, topics, data]) => ({
    address: address.toLowerCase(),
    topics,
    data
  }));

  return { receiptsRoot, receiptLogs };
}
