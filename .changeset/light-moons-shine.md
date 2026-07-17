---
'proof-generation-api': minor
---

RPC endpoint env vars (`ETHEREUM_RPC`, `SEPOLIA_RPC`, `MATIC_RPC`, `AMOY_RPC`) now take a single URL string instead of a JSON array, and client-side endpoint rotation has been removed. Endpoint redundancy is delegated to the configured endpoint itself; transient RPC failures still get one bounded retry against the same endpoint before the error is returned.
