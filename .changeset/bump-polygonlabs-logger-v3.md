---
"proof-generation-api": patch
---

Update @polygonlabs/logger to 3.x, which sanitises RPC fetch errors so provider URLs with token query strings never reach logs or serialised error output.
