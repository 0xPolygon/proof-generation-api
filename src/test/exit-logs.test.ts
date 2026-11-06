import { describe, expect, it } from 'vitest';

import { POSBridgeError } from '@polygonlabs/maticjs';

import { BlockNotIncludedError, TxNotCheckpointedError } from '../errors.ts';
import { toDeterministicError } from '../exitLogs.ts';

// The SDK error code is the contract this classification relies on: a code that
// maps here becomes a 404 with a fixed public message and stops the retry loop;
// anything else is retried on the next RPC. Pin every mapped code plus an
// unmapped one, so an SDK code rename shows up here rather than as retried 502s.
describe('toDeterministicError', () => {
  const cases = [
    {
      code: 'LOG_NOT_FOUND_IN_RECEIPT',
      errorClass: BlockNotIncludedError,
      message: 'Event Signature log not found in tx receipt'
    },
    {
      code: 'INDEX_OUT_OF_BOUNDS',
      errorClass: BlockNotIncludedError,
      message: 'Token index out of range for this transaction'
    },
    {
      code: 'BURN_TX_NOT_CHECKPOINTED',
      errorClass: TxNotCheckpointedError,
      message: 'Burn transaction has not been checkpointed yet'
    }
  ] as const;

  for (const { code, errorClass, message } of cases) {
    it(`maps ${code} to ${errorClass.name}`, () => {
      const cause = new POSBridgeError(code, 'sdk message');
      const result = toDeterministicError(cause);
      expect(result).instanceOf(errorClass);
      expect(result).property('message', message);
      expect(result).property('statusCode', 404);
    });
  }

  it('leaves an unmapped SDK code to the retry loop', () => {
    expect(toDeterministicError(new POSBridgeError('TRANSACTION_NOT_FOUND', 'not found'))).equal(
      undefined
    );
  });

  it('leaves a non-SDK error to the retry loop', () => {
    expect(toDeterministicError(new Error('Log not found in receipt'))).equal(undefined);
  });
});
