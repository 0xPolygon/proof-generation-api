---
"proof-generation-api": major
---

Remove the zkEVM proof-generation endpoints (`/zkevm/mainnet` and `/zkevm/testnet` routes) — the underlying chains are sunset and their infrastructure no longer answers. PoS (v1) endpoints are unchanged.

## Breaking changes

- Removed `GET /api/zkevm/{network}/bridge`
- Removed `GET /api/zkevm/{network}/merkle-proof`
- Removed the `ZKEVM_MAINNET_URL` and `ZKEVM_TESTNET_URL` environment variables — they are no longer recognized configuration
