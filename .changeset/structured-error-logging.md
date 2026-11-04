---
'proof-generation-api': patch
---

Requests with a malformed JSON body now get a `400` response with the parse error message instead of a `500`, and the failure is logged as a single structured JSON line rather than a multi-line plain-text stack trace.
