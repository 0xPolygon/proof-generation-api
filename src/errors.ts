import { HTTPError } from '@polygonlabs/verror';

// Each error extends HTTPError directly, declaring its statusCode explicitly.
// This avoids the name-literal conflict that arises when subclassing the
// concrete NotFound/BadRequest classes (whose name fields are sealed literals).
// Services use instanceof HTTPError in retry loops — any HTTP-level error means
// stop retrying; transient RPC failures propagate as plain Errors.

export class BlockNotIncludedError extends HTTPError {
  override readonly name = 'BlockNotIncludedError' as const;
  override readonly statusCode = 404 as const;
}

// Kept as 404: thrown when isCheckpointed() cannot resolve the tx hash, which is
// ambiguous between "invalid hash" and a transient RPC failure. Changing to 400
// risks breaking consumers that branch on status codes.
export class IncorrectTxError extends HTTPError {
  override readonly name = 'IncorrectTxError' as const;
  override readonly statusCode = 404 as const;
}

export class TxNotCheckpointedError extends HTTPError {
  override readonly name = 'TxNotCheckpointedError' as const;
  override readonly statusCode = 404 as const;
}

// Retries were exhausted on failures that are not about the request itself
// (RPC timeouts, network or server errors), so the client should see a 5xx rather
// than a misleading "not found".
export class UpstreamRpcError extends HTTPError {
  override readonly name = 'UpstreamRpcError' as const;
  override readonly statusCode = 502 as const;
}

// Thrown by the in-flight cap on exit-payload routes. Clients should retry after the
// Retry-After delay; the central error handler does not log it (see src/index.ts).
export class ServerBusyError extends HTTPError {
  override readonly name = 'ServerBusyError' as const;
  override readonly statusCode = 503 as const;
}

// The SDK's error, recognised by shape rather than `instanceof`. A class check fails
// whenever the error comes from a different copy of the package than the one this
// module imported (a duplicate install, another realm, a bundler split), and then a
// deterministic 404 silently becomes a retried 502. The SDK documents `name` and
// `code` as its stable contract. Switch to the SDK's own `isPOSBridgeError` guard
// once the dependency moves to 4.0.0, which exports it.
export interface SdkBridgeError {
  name: 'POSBridgeError';
  code: string;
  type?: unknown;
}

export const isPOSBridgeError = (err: unknown): err is SdkBridgeError =>
  typeof err === 'object' &&
  err !== null &&
  'name' in err &&
  err.name === 'POSBridgeError' &&
  'code' in err &&
  typeof err.code === 'string';

// Fields for retry-warning log lines. An SDK error carries a stable `code` plus the
// legacy 3.x `type` string. Raw ethers failures pass through the SDK's read path
// unwrapped and carry their own string `code` (SERVER_ERROR, TIMEOUT, CALL_EXCEPTION),
// the bulk of retry warnings in prod, so keep logging that too.
export const sdkErrorLogFields = (
  error: unknown
): { errorType: string | undefined; errorCode: string | undefined } => {
  if (isPOSBridgeError(error)) {
    return {
      errorType: typeof error.type === 'string' ? error.type : undefined,
      errorCode: error.code
    };
  }
  const errorCode =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  return { errorType: undefined, errorCode };
};
