import { describe, expect, it } from 'vitest';

import {
  BurnTxNotCheckpointedError,
  IndexOutOfBoundsError,
  LogNotFoundInReceiptError,
  ProofBuildError,
  ReceiptsRootMismatchError,
  TransactionNotFoundError
} from '@polygonlabs/maticjs';

import { BlockNotIncludedError, TxNotCheckpointedError } from '../errors.ts';
import { toDeterministicError } from '../exitLogs.ts';

const TX = `0x${'1'.repeat(64)}`;

// The SDK condition class is the contract this classification relies on: a condition
// that maps here becomes a 404 with a fixed public message and stops the retry loop;
// anything else is retried on the next RPC. Pin every mapped condition plus unmapped
// ones, so an SDK rename shows up here rather than as retried 502s.
describe('toDeterministicError', () => {
  const cases = [
    {
      condition: new LogNotFoundInReceiptError('sdk message', {
        info: { eventSignature: '0xabc', transactionHash: TX }
      }),
      errorClass: BlockNotIncludedError,
      message: 'Event Signature log not found in tx receipt'
    },
    {
      condition: new IndexOutOfBoundsError('sdk message', { info: { index: 3, available: 1 } }),
      errorClass: BlockNotIncludedError,
      message: 'Token index out of range for this transaction'
    },
    {
      condition: new BurnTxNotCheckpointedError('sdk message'),
      errorClass: TxNotCheckpointedError,
      message: 'Burn transaction has not been checkpointed yet'
    }
  ] as const;

  for (const { condition, errorClass, message } of cases) {
    it(`maps ${condition.name} to ${errorClass.name}`, () => {
      const result = toDeterministicError(condition);
      expect(result).instanceOf(errorClass);
      expect(result).property('message', message);
      expect(result).property('statusCode', 404);
      expect(result).property('cause', condition);
    });

    // What the SDK actually throws: the operation error naming the call, with the
    // condition as its cause.
    it(`maps ${condition.name} wrapped in an operation error`, () => {
      const thrown = new ProofBuildError({
        info: { operation: 'buildExitPayloadOnIndex', mode: 'read' },
        cause: condition
      });
      const result = toDeterministicError(thrown);
      expect(result).instanceOf(errorClass);
      expect(result).property('message', message);
    });
  }

  it('leaves unmapped SDK conditions to the retry loop', () => {
    const notFound = new TransactionNotFoundError('not found', { info: { transactionHash: TX } });
    const rootMismatch = new ReceiptsRootMismatchError('mismatch', {
      info: {
        blockNumber: 1,
        blockHash: TX,
        expectedReceiptsRoot: TX,
        computedReceiptsRoot: TX
      }
    });
    expect(toDeterministicError(notFound)).equal(undefined);
    expect(toDeterministicError(rootMismatch)).equal(undefined);
    expect(
      toDeterministicError(
        new ProofBuildError({
          info: { operation: 'buildExitPayloads', mode: 'read' },
          cause: rootMismatch
        })
      )
    ).equal(undefined);
  });

  it('leaves a non-SDK error to the retry loop', () => {
    expect(toDeterministicError(new Error('Log not found in receipt'))).equal(undefined);
  });
});
