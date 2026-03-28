---
"proof-generation-api": patch
---

Fix memory leak causing OOMKill under load.

Each proof generation request previously created new `ethers.js` provider instances and a `POSClient` on every attempt, including retries. These held HTTP connection pools and event emitters that the GC could not promptly reclaim, causing working-set memory to grow monotonically under concurrent traffic until the container hit its 2 GiB limit.

Two changes address this:

- **Provider singleton cache** — `POSClient` instances are now cached by RPC endpoint pair for the lifetime of the process. All requests and retries share the same initialised client rather than creating new ones.
- **`StaticJsonRpcProvider` instead of `JsonRpcProvider`** — the static variant makes no background block-polling calls and holds no cached chain state, making it safe to keep alive indefinitely. The regular provider's 4-second polling loop was accumulating memory in long-lived cached instances.

Additionally, the 1-second sleep between RPC retries has been removed. Retries switch to a different provider immediately — there is no reason to wait before trying a healthy endpoint.
