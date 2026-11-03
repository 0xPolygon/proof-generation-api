---
'proof-generation-api': patch
---

Reject exit-payload requests with 503 and a `Retry-After` header when a server is already handling too many, so other endpoints stay responsive under load.
