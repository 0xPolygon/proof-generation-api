import {
  BurnTxNotCheckpointedError,
  IndexOutOfBoundsError,
  isMaticjsError,
  LogNotFoundInReceiptError
} from '@polygonlabs/maticjs';

import { BlockNotIncludedError, TxNotCheckpointedError } from './errors.ts';

const ZERO_TOPIC = '0x0000000000000000000000000000000000000000000000000000000000000000';
const TRANSFER_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TRANSFER_WITH_METADATA_SIGNATURE =
  '0xf94915c6d1fd521cee85359239227480c7e8776d7caf1fc3bacad5c269b66a14';
const ERC1155_TRANSFER_SIGNATURE =
  '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';
const ERC1155_BATCH_TRANSFER_SIGNATURE =
  '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb';
const ERC721_BATCH_TRANSFER_SIGNATURE =
  '0xf871896b17e9cb7a64941c62c188a4f5c621b86800e3d15452ece01ce56073df';

interface ReceiptLog {
  topics: string[];
}

const topicEquals = (topic: string | undefined, expected: string): boolean =>
  topic?.toLowerCase() === expected.toLowerCase();

// Mirrors maticjs's getAllLogIndices_ so the pre-check accepts exactly the logs
// maticjs would later accept; a log it would reject is a deterministic 404 that
// should not cost a full proof build.
// maticjs only uses getAllLogIndices_ for tokenIndex > 0 and all-exit-payloads; for
// tokenIndex 0 it uses getLogIndex_, which has no ERC721 batch special case.
export function countExitLogs({
  logs,
  eventSignature,
  allIndices
}: {
  logs: ReceiptLog[];
  eventSignature: string;
  allIndices: boolean;
}): number {
  const sig = eventSignature.toLowerCase();
  return logs.filter((log) => {
    switch (sig) {
      case TRANSFER_SIGNATURE:
      case TRANSFER_WITH_METADATA_SIGNATURE:
        return topicEquals(log.topics[0], sig) && topicEquals(log.topics[2], ZERO_TOPIC);
      case ERC1155_TRANSFER_SIGNATURE:
      case ERC1155_BATCH_TRANSFER_SIGNATURE:
        return topicEquals(log.topics[0], sig) && topicEquals(log.topics[3], ZERO_TOPIC);
      case ERC721_BATCH_TRANSFER_SIGNATURE:
        if (!allIndices) return topicEquals(log.topics[0], sig);
        return (
          topicEquals(log.topics[0], TRANSFER_SIGNATURE) && topicEquals(log.topics[2], ZERO_TOPIC)
        );
      default:
        return topicEquals(log.topics[0], sig);
    }
  }).length;
}

// Throws the 404 for a burn tx that cannot yield the requested exit payload.
// `tokenIndex` is omitted for all-exit-payloads.
export function assertExitLogPresent({
  logs,
  eventSignature,
  tokenIndex
}: {
  logs: ReceiptLog[];
  eventSignature: string;
  tokenIndex?: number;
}): void {
  const count = countExitLogs({
    logs,
    eventSignature,
    allIndices: tokenIndex === undefined || tokenIndex > 0
  });
  if (count === 0) {
    throw new BlockNotIncludedError('Event Signature log not found in tx receipt');
  }
  if (tokenIndex !== undefined && tokenIndex >= count) {
    throw new BlockNotIncludedError('Token index out of range for this transaction');
  }
}

// These conditions are properties of the transaction, so retrying (on any RPC)
// cannot change them. Classified by the SDK condition's class name, found anywhere in
// the cause chain (the SDK throws an operation error such as ProofBuildError with the
// condition as its cause), rather than by message text, which is free to change between
// SDK releases. Recognition is by name, not class (see src/errors.ts), so the caller
// passes the thrown value as-is: normalising it to an `Error` first would drop a
// plain-object error's chain.
export function toDeterministicError(
  err: unknown
): BlockNotIncludedError | TxNotCheckpointedError | undefined {
  if (!isMaticjsError(err)) return undefined;
  // VError only accepts an Error as the cause; a plain-object error is still classified.
  const cause = err instanceof Error ? { cause: err } : {};
  if (LogNotFoundInReceiptError.has(err)) {
    return new BlockNotIncludedError('Event Signature log not found in tx receipt', cause);
  }
  if (IndexOutOfBoundsError.has(err)) {
    return new BlockNotIncludedError('Token index out of range for this transaction', cause);
  }
  if (BurnTxNotCheckpointedError.has(err)) {
    return new TxNotCheckpointedError('Burn transaction has not been checkpointed yet', cause);
  }
  return undefined;
}
