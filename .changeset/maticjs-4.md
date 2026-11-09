---
'proof-generation-api': minor
---

Migrate to `@polygonlabs/maticjs` 4.0 (exact prerelease pin) from the frozen `@maticnetwork/maticjs` 3.x line. API responses are unchanged byte-for-byte, with one exception: an exit-payload request for a burn transaction that is still pending (submitted but not yet in a block) now gets an immediate `404` "Burn transaction has not been checkpointed yet", the same answer as for a mined burn awaiting its checkpoint. It used to fail after exhausting retries. Retry-warning log lines replace the `errorEvent` field (empty for SDK errors; the full error, including any RPC-library event, is still logged under `err`) with `errorType` (the SDK's legacy error type); `errorCode` now carries the name of the SDK condition behind the failure (for example `LogNotFoundInReceiptError`), or the RPC library's code for raw RPC failures as before.
