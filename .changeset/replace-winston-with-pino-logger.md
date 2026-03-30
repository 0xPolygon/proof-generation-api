---
"proof-generation-api": patch
---

Replace Winston with the shared pino logger and migrate errors to VError.

The logger now uses `@polygonlabs/logger` (pino-based), pre-configured for
Datadog log ingestion and automatic Sentry capture on `logger.error({ err })`
calls. Log fields are structured — the `err` key triggers VError cause-chain
unwrapping and Sentry exception capture; other error fields are no longer
silently swallowed.

The custom `InfoError(type, message)` class is replaced with a
`@polygonlabs/verror` hierarchy (`BlockNotIncludedError`, `IncorrectTxError`,
`TxNotCheckpointedError`, `ZKEVMServiceError`). Error names are now visible in
Sentry grouping rather than all appearing as a generic class.
