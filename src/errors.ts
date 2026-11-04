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
