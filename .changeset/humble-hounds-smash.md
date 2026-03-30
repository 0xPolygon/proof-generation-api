---
"proof-generation-api": patch
---

Upgrade ethers from the hard-pinned 5.5.1 to ^5.8.0.

The pin was introduced incidentally in a September 2025 commit that added eRPC request headers. There is no compatibility reason to stay below 5.8.0 — `@maticnetwork/maticjs-ethers` declares `"ethers": "^5.5.1"`, so 5.8.x is within its supported range, and the `StaticJsonRpcProvider({ url, headers })` constructor syntax used by this service is unchanged across the 5.x series.
