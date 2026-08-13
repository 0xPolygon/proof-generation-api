---
"proof-generation-api": patch
---

The server now warms its RPC provider connections during startup, eliminating first-request network-detection failures immediately after boot.
