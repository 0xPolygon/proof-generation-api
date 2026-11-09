import { isMaticjsError, MATICJS_ERROR_NAMES } from '@polygonlabs/maticjs';
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

// Kept as 404: thrown when getCheckpointStatus() cannot resolve the tx hash, which is
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

// SDK errors are recognised by name through the cause chain (the SDK's own
// `isMaticjsError` and per-class `has`/`find`), never with `instanceof`: a class check
// fails whenever the error comes from a different copy of the package than the one this
// module imported (a duplicate install, another realm, a bundler split) or has been
// through JSON, and then a deterministic 404 silently becomes a retried 502.
const SDK_ERROR_NAMES: ReadonlySet<string> = MATICJS_ERROR_NAMES;

// The innermost SDK error in the chain. A public SDK method throws an operation error
// (ExitError, ProofBuildError, ...) whose cause is the condition that actually happened;
// the operation name only says which call failed, so the condition is what is worth
// logging. Below the condition sit only non-SDK fetch/parser errors.
const innermostSdkError = (err: unknown): { name: string; type: unknown } | undefined => {
  let found: { name: string; type: unknown } | undefined;
  const seen = new Set<unknown>();
  let node = err;
  while (typeof node === 'object' && node !== null && !seen.has(node)) {
    seen.add(node);
    if ('name' in node && typeof node.name === 'string' && SDK_ERROR_NAMES.has(node.name)) {
      found = { name: node.name, type: 'type' in node ? node.type : undefined };
    }
    node = 'cause' in node ? node.cause : undefined;
  }
  return found;
};

// Fields for retry-warning log lines. For an SDK error, `errorCode` is the condition's
// class name (4.0 dropped the old string `code`; the class name is its stable
// replacement) and `errorType` the legacy 3.x `type` string, which only the conditions
// 3.x already reported carry. Library errors (ethers SERVER_ERROR, TIMEOUT,
// CALL_EXCEPTION) reach us unwrapped and carry their own string `code`; they are the
// bulk of retry warnings in prod, so keep logging that too.
export const sdkErrorLogFields = (
  error: unknown
): { errorType: string | undefined; errorCode: string | undefined } => {
  const sdkError = isMaticjsError(error) ? innermostSdkError(error) : undefined;
  if (sdkError) {
    return {
      errorType: typeof sdkError.type === 'string' ? sdkError.type : undefined,
      errorCode: sdkError.name
    };
  }
  const errorCode =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  return { errorType: undefined, errorCode };
};
