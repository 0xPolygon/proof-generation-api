import { describe, expect, it } from 'vitest';

import { BlockNotIncludedError, isPOSBridgeError, sdkErrorLogFields } from '../errors.ts';
import { toDeterministicError } from '../exitLogs.ts';

// The SDK error is recognised by its stable `name` and `code`, never by class, so an
// error thrown by a different copy of the package (duplicate install, another realm,
// a bundler split) classifies exactly like one from the copy this service imported.
// These errors are deliberately NOT instances of the SDK's POSBridgeError class.
const lookalike = (code: string): Error =>
  Object.assign(new Error('from another copy of the SDK'), {
    name: 'POSBridgeError',
    code,
    type: 'legacy_type'
  });

describe('SDK error recognised by shape', () => {
  it('classifies a lookalike error as a deterministic 404', () => {
    const result = toDeterministicError(lookalike('LOG_NOT_FOUND_IN_RECEIPT'));
    expect(result).instanceOf(BlockNotIncludedError);
    expect(result).property('statusCode', 404);
  });

  it('logs type and code from a plain object shaped like the error', () => {
    const plain = { name: 'POSBridgeError', code: 'RECEIPTS_ROOT_MISMATCH', type: 'legacy_type' };
    expect(isPOSBridgeError(plain)).equal(true);
    expect(sdkErrorLogFields(plain)).deep.equal({
      errorType: 'legacy_type',
      errorCode: 'RECEIPTS_ROOT_MISMATCH'
    });
  });

  it('rejects a different name, a non-string code, and non-objects', () => {
    const wrongName = Object.assign(new Error('x'), {
      name: 'Error',
      code: 'LOG_NOT_FOUND_IN_RECEIPT'
    });
    expect(isPOSBridgeError(wrongName)).equal(false);
    expect(toDeterministicError(wrongName)).equal(undefined);
    expect(isPOSBridgeError({ name: 'POSBridgeError', code: 42 })).equal(false);
    expect(isPOSBridgeError(null)).equal(false);
    expect(isPOSBridgeError('POSBridgeError')).equal(false);
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
