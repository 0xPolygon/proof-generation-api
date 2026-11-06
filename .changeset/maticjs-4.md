---
'proof-generation-api': minor
---

Migrate to `@polygonlabs/maticjs` 4.0 (exact prerelease pin) from the frozen `@maticnetwork/maticjs` 3.x line. API responses are unchanged byte-for-byte. Retry-warning log lines replace the `errorEvent` field (empty for SDK errors; the full error, including any RPC-library event, is still logged under `err`) with `errorType` (the SDK's legacy error type); `errorCode` now carries the SDK's stable error code, or the RPC library's code for raw RPC failures as before.
