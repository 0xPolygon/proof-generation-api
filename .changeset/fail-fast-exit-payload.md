---
'proof-generation-api': patch
---

Return 404 immediately for exit-payload requests whose event log is not in the burn transaction receipt instead of retrying, report exhausted RPC failures as 5xx instead of a misleading 404, limit concurrent receipt fetches, and fail slow RPC calls after 10s with a 20s overall retry budget so requests no longer hang for minutes.
