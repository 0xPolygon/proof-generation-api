# proof-generation-api

## 1.0.4

### Patch Changes

- ac53590: All routes now emit a structured debug log on every incoming request.

  Each entry includes the full set of parameters needed to replay the request — `burnTxHash`, `eventSignature`, `tokenIndex` for exit-payload routes; `blockNumber` for block-included; `start`/`end`/`number` for merkle-proof; `net_id`/`deposit_cnt` for zkEVM routes — as individual structured fields rather than interpolated strings. This makes them extractable from a Datadog log export CSV for corpus building during incident investigation.

## 1.0.3

### Patch Changes

- 3afcd07: Upgrade ethers from the hard-pinned 5.5.1 to ^5.8.0.

  The pin was introduced incidentally in a September 2025 commit that added eRPC request headers. There is no compatibility reason to stay below 5.8.0 — `@maticnetwork/maticjs-ethers` declares `"ethers": "^5.5.1"`, so 5.8.x is within its supported range, and the `StaticJsonRpcProvider({ url, headers })` constructor syntax used by this service is unchanged across the 5.x series.

## 1.0.2

### Patch Changes

- 9647a44: Enforce coupled RPC array length at startup; document provider-pairing constraint in README, .env.example, and CLAUDE.md
- 7de8ede: Fix memory leak causing OOMKill under load.

  Each proof generation request previously created new `ethers.js` provider instances and a `POSClient` on every attempt, including retries. These held HTTP connection pools and event emitters that the GC could not promptly reclaim, causing working-set memory to grow monotonically under concurrent traffic until the container hit its 2 GiB limit.

  Two changes address this:
  - **Provider singleton cache** — `POSClient` instances are now cached by RPC endpoint pair for the lifetime of the process. All requests and retries share the same initialised client rather than creating new ones.
  - **`StaticJsonRpcProvider` instead of `JsonRpcProvider`** — the static variant makes no background block-polling calls and holds no cached chain state, making it safe to keep alive indefinitely. The regular provider's 4-second polling loop was accumulating memory in long-lived cached instances.

  Additionally, the 1-second sleep between RPC retries has been removed. Retries switch to a different provider immediately — there is no reason to wait before trying a healthy endpoint.

- ee9fa21: Sync OpenAPI spec version with package.json; rewrite route descriptions to reflect current architecture
- 0cd3878: Replace Winston with the shared pino logger and migrate errors to VError.

  The logger now uses `@polygonlabs/logger` (pino-based), pre-configured for
  Datadog log ingestion and automatic Sentry capture on `logger.error({ err })`
  calls. Log fields are structured — the `err` key triggers VError cause-chain
  unwrapping and Sentry exception capture; other error fields are no longer
  silently swallowed.

  The custom `InfoError(type, message)` class is replaced with a
  `@polygonlabs/verror` hierarchy (`BlockNotIncludedError`, `IncorrectTxError`,
  `TxNotCheckpointedError`, `ZKEVMServiceError`). Error names are now visible in
  Sentry grouping rather than all appearing as a generic class.

## 1.0.1

### Patch Changes

- 4e5633e: Allow `http://` RPC URLs; enforce `https://` only for `rpc.polygon.tools`

## 1.0.0

### Major Changes

- 479c1bc: Migrate runtime and stack to current team standards.
  - **Node 24 native TypeScript** — removed Bun, ts-node, and tsx; the service now runs `.ts` files directly via Node 24's built-in type stripping. No transpile or build step required at runtime.
  - **Express v5** — upgraded from Express v4. Route handlers are now fully async-safe; unhandled promise rejections propagate correctly without wrapper middleware.
  - **OpenAPI spec** — Zod schemas serve dual duty as runtime validators and OpenAPI source of truth via `@asteasolutions/zod-to-openapi`. Interactive API docs served at `/docs` via `@scalar/express-api-reference`. Spec artifact committed at `openapi.json` and validated in CI.
  - **Environment validation** — `@t3-oss/env-core` with Zod validates all required env vars at startup; service fails fast on missing or malformed config rather than crashing at first use.
  - **Changesets release pipeline** — versioning, changelog, and Docker image publishing are now driven by changesets. Image tags are semver (e.g. `1.0.0`) rather than generated timestamps.
