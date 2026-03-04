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

## Architecture

**Entry point:** `src/bin/apiServer.ts` — imports `src/instrument.ts` (Sentry, must load first) then calls `startApiServer()` from `src/index.ts`.

**Request flow:** Express v5 → CORS → JSON parser → `/health-check` → `/api` routes

**Route mounting:** See `src/routes/index.ts` for the router tree. Each route file in `src/routes/` owns its own path segment.

**Validation:** Zod v4 schemas in `src/schemas.ts` serve dual duty — runtime validation via `safeParse()` and OpenAPI spec generation via `@asteasolutions/zod-to-openapi`. Each route validates with `Schema.safeParse({ params: req.params, query: req.query })` and on failure passes `result.error.issues[0]?.message` to `handleBadRequest()`.

**Service layer** (`src/services/`): Business logic for proof generation. Uses `@maticnetwork/maticjs` + ethers v5. RPC calls use round-robin failover across configured endpoints (max retries = 2× endpoint count).

**Environment:** `src/env.ts` validates env vars with `@t3-oss/env-core` + Zod. See `.env.example` for the required variables.

**Response format inconsistency:** 400 responses use `{ error: true, msg }` while 404/500 use `{ error: true, message }`. This matches production behavior — see `src/helpers/responseHandlers.ts`.

## Conventions

- **Node 24 ESM** — `"type": "module"`, TypeScript `module: nodenext`, `.ts` extensions in imports
- **Strict TypeScript** — See `tsconfig.json`; notably includes `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
- **Import ordering** — `perfectionist/sort-imports`: scoped packages (`@foo`) before unscoped, alphabetical within groups
- **Type imports** — Always use `import type` for type-only imports (`@typescript-eslint/consistent-type-imports`)

## Testing

- Test runner: **Vitest** (`pnpm test`); assertions use Chai API via Vitest's built-in `expect()`
- Test files live in `src/test/`, picked up via `vitest.config.ts`

Tests make live RPC calls (no mocks). The `getAgent()` helper in `src/test/helpers/agent.ts` returns a Supertest agent targeting either the local Express app or a remote URL via `TEST_BASE_URL`. Remote targets require a `User-Agent` header (Cloudflare blocks bare requests).

Error tests assert `body.error` and exact `body.msg` strings to ensure parity with production.

## Zod v4 Gotchas

- Enum error callback: `z.enum([...], { error: (issue) => \`message ${issue.input}\` })`
- Coercion NaN handling: `z.coerce.number({ error: () => 'message' })` — the `error` param catches NaN from non-numeric strings
- Missing field error: `z.string({ error: () => 'message' })` to override default type error on `undefined`
- `extendZodWithOpenApi(z)` is idempotent; called at module load in `schemas.ts`
- Scalar config: `apiReference({ content: spec })` — not `{ spec: { content: ... } }`
