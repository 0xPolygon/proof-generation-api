---
'proof-generation-api': patch
---

Requests for a fast merkle proof over a block range wider than 65536 blocks now get an immediate `400` "Block range too large: end - start + 1 must be at most 65536" instead of being retried against every RPC provider. Exit-payload requests for the all-zero transaction hash get the existing `404` "Incorrect burn transaction" without any RPC call, and a transaction that every configured provider reports as unknown is now asked about once per provider rather than twice before the same `404` is returned.
