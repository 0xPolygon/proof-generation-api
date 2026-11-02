---
'proof-generation-api': patch
---

Return 404 immediately for exit-payload requests whose event log is not in the burn transaction receipt instead of retrying, report exhausted RPC failures as 5xx instead of a misleading 404, and limit concurrent receipt fetches.
