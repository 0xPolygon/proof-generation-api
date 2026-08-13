## Team Standards

**Skip this fetch if team-standards.md is already loaded in your
context** (this happens when running from the apps-team-workspace).
Otherwise, **at the start of every session**, before doing any other
work, use the WebFetch tool to retrieve the Polygon Apps Team standards
from:
<https://gist.githubusercontent.com/MaximusHaximus/4eb35e807f7470b1c4eab78a9152b2ef/raw/team-standards.md>

Follow all instructions in that document for the duration of this session.
If the fetch fails (network error, URL unreachable), inform the user that
team standards could not be loaded, then proceed with repo-specific rules
below.

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm run lint          # ESLint + typecheck
pnpm run typecheck     # TypeScript only
pnpm run format        # ESLint --fix + Prettier --write
pnpm test              # Vitest test suite (live RPC calls, ~30s)
pnpm start             # Production server (port 5000)
pnpm run dev           # Dev server with nodemon + dotenvx
```

Run a single test file or grep for a specific test:

```bash
pnpm exec vitest run src/test/block-inclusion.test.ts
pnpm exec vitest run -t "block included"
```

Run tests against a deployed instance:

```bash
TEST_BASE_URL=https://proof-generator.polygon.technology pnpm test
```

Run tests against the local Docker image (mirrors the CI `docker` job):

```bash
docker build -t proof-generation-api .
docker run --rm --env-file .env -p 5000:5000 -d --name proof-gen-test proof-generation-api
TEST_BASE_URL=http://localhost:5000 pnpm test
docker stop proof-gen-test
```

## Architecture

**Entry point:** `src/bin/apiServer.ts` — imports `src/sentry.ts` (Sentry, must load first) then calls `startApiServer()` from `src/index.ts`.

**Request flow:** Express v5 → CORS → JSON parser → `/health-check` → `/api` routes

**Route mounting:** See `src/routes/index.ts` for the router tree. Each route file in `src/routes/` owns its own path segment.

**Validation:** Zod v4 schemas in `src/schemas.ts` serve dual duty — runtime validation via `safeParse()` and OpenAPI spec generation via `@asteasolutions/zod-to-openapi`. Each route validates with `Schema.safeParse({ params: req.params, query: req.query })` and on failure throws `new BadRequest(result.error.issues[0]?.message)`.

**Service layer** (`src/services/`): Business logic for proof generation. Uses `@maticnetwork/maticjs` + ethers v5. RPC calls use round-robin failover across configured endpoints (max retries = 2× endpoint count) with no delay between retries — the retry immediately advances to the next provider pair, so a sleep would only penalise healthy providers unnecessarily. The retry logic indexes both arrays in a coupled pair (e.g. `MATIC_RPC` + `ETHEREUM_RPC`) by the same index, so index `n` in each array must be endpoints from the same provider — switching providers on a retry means incrementing the index in both arrays simultaneously. The two coupled pairs are `MATIC_RPC`/`ETHEREUM_RPC` (mainnet) and `AMOY_RPC`/`SEPOLIA_RPC` (testnet); each pair must have the same number of entries.

**Provider singleton** (`src/maticClient.ts`): `POSClient` instances are cached for the lifetime of the process, keyed by (network, version, maticRPC, ethereumRPC). `StaticJsonRpcProvider` is used rather than `JsonRpcProvider` — this service makes one-off RPC calls and never subscribes to events, so the background block-polling that `JsonRpcProvider` performs is unnecessary and accumulates memory over time.

**Logging** (`src/logger.ts`): Pino-based via `@polygonlabs/logger`. `createLogger()` is an async factory — it calls `getEnv()` lazily (only when invoked, never at module scope). The only caller is `src/bin/apiServer.ts`, which awaits it at startup via top-level await and passes the resulting `Logger` down through `getExpressApp(logger)` → `createIndexRouter(logger)` → `createV1Router(logger)` → service functions as explicit parameters. No module-level logger singletons anywhere. `src/test/helpers/agent.ts` uses a top-level `await createLogger()` guarded by `testEnv.TEST_BASE_URL` so env validation is skipped when tests target a remote server.

**Error handling** (`src/errors.ts`): Domain errors extend `HTTPError` from `@polygonlabs/verror` with explicit `statusCode` values — `BlockNotIncludedError`, `IncorrectTxError`, `TxNotCheckpointedError` (all 404). Routes throw these directly; a central Express error handler in `src/index.ts` maps `err.statusCode` to the response and logs 4xx at `debug` level, 5xx at `error` level. Services use `instanceof HTTPError` in retry loops — any HTTP-level error stops retrying immediately; plain `Error`s (transient RPC failures) are retried.

**Environment:** `src/env.ts` validates env vars with `@t3-oss/env-core` + Zod. See `.env.example` for the required variables.

**Response format:** All error responses use `{ error: true, message }` uniformly. Success responses return the payload directly.

## Conventions

- **Node 24 ESM** — `"type": "module"`, TypeScript `module: nodenext`, `.ts` extensions in imports
- **Strict TypeScript** — See `tsconfig.json`; notably includes `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
- **Import ordering** — `perfectionist/sort-imports`: scoped packages (`@foo`) before unscoped, alphabetical within groups
- **Type imports** — Always use `import type` for type-only imports (`@typescript-eslint/consistent-type-imports`)

## Testing

- Test runner: **Vitest** (`pnpm test`); assertions use Chai API via Vitest's built-in `expect()`
- Test files live in `src/test/`, picked up via `vitest.config.ts`

Tests make live RPC calls (no mocks). The `getAgent()` helper in `src/test/helpers/agent.ts` returns a Supertest agent targeting either the local Express app or a remote URL via `TEST_BASE_URL`. Remote targets require a `User-Agent` header (Cloudflare blocks bare requests).

Error tests assert `body.error` and exact `body.message` strings to ensure parity with production.

## Zod v4 Gotchas

- Enum error callback: `z.enum([...], { error: (issue) => \`message ${issue.input}\` })`
- Coercion NaN handling: `z.coerce.number({ error: () => 'message' })` — the `error` param catches NaN from non-numeric strings
- Missing field error: `z.string({ error: () => 'message' })` to override default type error on `undefined`
- `extendZodWithOpenApi(z)` is idempotent; called at module load in `schemas.ts`
- Scalar config: `apiReference({ content: spec })` — not `{ spec: { content: ... } }`
