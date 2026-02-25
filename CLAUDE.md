# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Never reproduce in documentation or prompts what can be read directly from the repo.**

Any hardcoded list, table, or enumeration that mirrors data already present elsewhere in the
repository is a second source of truth. It will silently drift out of sync and mislead anyone
(human or AI) who reads it.

Concretely:

- Instructions should say _where_ to look, not _what you will find there_. If the answer lives
  in a file, point to the file.

## Commands

```bash
npm run lint          # ESLint + typecheck
npm run typecheck     # TypeScript only
npm run format        # ESLint --fix + Prettier --write
npm test              # Mocha test suite (live RPC calls, ~30s)
npm start             # Production server (port 5000)
npm run dev           # Dev server with nodemon + dotenvx
```

Run a single test file or grep for a specific test:

```bash
npx mocha src/test/block-inclusion.test.ts
npx mocha --grep "block included"
```

Run tests against a deployed instance:

```bash
TEST_BASE_URL=https://proof-generator.polygon.technology npm test
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
- **No `!` assertions** — See parent workspace `CLAUDE.md`
- **Pre-commit hooks** — Husky runs lint-staged (Prettier + ESLint fix)

## Testing

- Test runner: **Mocha** (`npm test`); assertion library: **Chai** (`expect()` style)
- Test files live in `tests/`, picked up via `.mocharc.json` (`"spec": "tests/**/*.ts"`)
- Import `describe`, `it`, `before`, `after` explicitly from `"mocha"` — this gives TypeScript
  types without global type injection, and no `tsconfig.json` or ESLint changes are needed
- Always use `function()` syntax, never arrow functions — Mocha binds `this` (for `this.timeout()`)
- Set `this.timeout(N)` on the root `describe` for suites that spawn child processes
- Declare shared state with `let foo!: Type` (definite assignment) in describe scope; assign in `before()`
- Cleanup in `after()`, not `process.on("exit")` — Mocha controls teardown order on failure
- Chai assertions: `expect(val).to.equal(x)`, `.to.include(x)`, `.to.have.property(x)`,
  `.to.be.true`, `.to.not.include(x)` — pass the error message as second arg to `expect(val, msg)`

Tests make live RPC calls (no mocks). The `getAgent()` helper in `src/test/helpers/agent.ts` returns a Supertest agent targeting either the local Express app or a remote URL via `TEST_BASE_URL`. Remote targets require a `User-Agent` header (Cloudflare blocks bare requests).

Error tests assert `body.error` and exact `body.msg` strings to ensure parity with production.

## Zod v4 Gotchas

- Enum error callback: `z.enum([...], { error: (issue) => \`message ${issue.input}\` })`
- Coercion NaN handling: `z.coerce.number({ error: () => 'message' })` — the `error` param catches NaN from non-numeric strings
- Missing field error: `z.string({ error: () => 'message' })` to override default type error on `undefined`
- `extendZodWithOpenApi(z)` is idempotent; called at module load in `schemas.ts`
- Scalar config: `apiReference({ content: spec })` — not `{ spec: { content: ... } }`
