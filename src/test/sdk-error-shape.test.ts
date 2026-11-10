import { describe, expect, it } from 'vitest';

import {
  BurnTxNotCheckpointedError,
  LogNotFoundInReceiptError,
  ProofBuildError,
  ReceiptsRootMismatchError
} from '@polygonlabs/maticjs';

import { BlockNotIncludedError, sdkErrorLogFields, TxNotCheckpointedError } from '../errors.ts';
import { toDeterministicError } from '../exitLogs.ts';

const TX = `0x${'1'.repeat(64)}`;

// SDK errors are recognised by name through the cause chain, never by class, so an
// error thrown by a different copy of the package (duplicate install, another realm,
// a bundler split) or read back from JSON classifies exactly like one from the copy
// this service imported. These errors are deliberately NOT instances of the SDK's
// classes.
const lookalike = (): Error =>
  Object.assign(new Error('from another copy of the SDK'), {
    name: 'LogNotFoundInReceiptError',
    info: { eventSignature: '0xabc', transactionHash: TX }
  });

const roundTrip = (err: Error): unknown => JSON.parse(JSON.stringify(err));

describe('SDK error recognised by name', () => {
  it('classifies a lookalike error from another package copy as a deterministic 404', () => {
    const result = toDeterministicError(lookalike());
    expect(result).instanceOf(BlockNotIncludedError);
    expect(result).property('statusCode', 404);
  });

  it('classifies a JSON round-tripped operation error by its condition', () => {
    const thrown = new ProofBuildError({
      info: { operation: 'buildExitPayloadOnIndex', mode: 'read' },
      cause: new BurnTxNotCheckpointedError('not checkpointed')
    });
    const plain = roundTrip(thrown);
    expect(plain).not.instanceOf(Error);
    const result = toDeterministicError(plain);
    expect(result).instanceOf(TxNotCheckpointedError);
    // VError only takes an Error as cause, so a plain object is classified without one.
    expect(result).not.property('cause');
    expect(sdkErrorLogFields(plain)).deep.equal({
      errorType: 'burn_tx_not_checkpointed',
      errorCode: 'BurnTxNotCheckpointedError'
    });
  });

  it('logs the innermost condition name, and its legacy type where it has one', () => {
    const condition = new ReceiptsRootMismatchError('mismatch', {
      info: { blockNumber: 1, blockHash: TX, expectedReceiptsRoot: TX, computedReceiptsRoot: TX }
    });
    const thrown = new ProofBuildError({
      info: { operation: 'buildExitPayloads', mode: 'read' },
      cause: condition
    });
    expect(sdkErrorLogFields(thrown)).deep.equal({
      errorType: undefined,
      errorCode: 'ReceiptsRootMismatchError'
    });
    expect(sdkErrorLogFields(new BurnTxNotCheckpointedError('x'))).deep.equal({
      errorType: 'burn_tx_not_checkpointed',
      errorCode: 'BurnTxNotCheckpointedError'
    });
  });

  it('rejects a lookalike without the SDK shape, and non-objects', () => {
    // Right name but no `info` object: not the SDK's error.
    const noInfo = Object.assign(new Error('x'), { name: 'LogNotFoundInReceiptError' });
    expect(toDeterministicError(noInfo)).equal(undefined);
    const wrongName = Object.assign(new Error('x'), {
      name: 'Error',
      info: { eventSignature: '0xabc', transactionHash: TX }
    });
    expect(toDeterministicError(wrongName)).equal(undefined);
    expect(toDeterministicError(null)).equal(undefined);
    expect(toDeterministicError('LogNotFoundInReceiptError')).equal(undefined);
    expect(LogNotFoundInReceiptError.has(noInfo)).equal(false);
  });

  it('keeps logging the raw RPC library code for non-SDK errors', () => {
    const ethersError = Object.assign(new Error('timeout'), { code: 'TIMEOUT' });
    expect(sdkErrorLogFields(ethersError)).deep.equal({
      errorType: undefined,
      errorCode: 'TIMEOUT'
    });
    expect(sdkErrorLogFields(new Error('no code'))).deep.equal({
      errorType: undefined,
      errorCode: undefined
    });
  });
});
