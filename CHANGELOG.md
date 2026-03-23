# proof-generation-api

## 1.0.0

### Major Changes

- 479c1bc: Migrate runtime and stack to current team standards.
  - **Node 24 native TypeScript** — removed Bun, ts-node, and tsx; the service now runs `.ts` files directly via Node 24's built-in type stripping. No transpile or build step required at runtime.
  - **Express v5** — upgraded from Express v4. Route handlers are now fully async-safe; unhandled promise rejections propagate correctly without wrapper middleware.
  - **OpenAPI spec** — Zod schemas serve dual duty as runtime validators and OpenAPI source of truth via `@asteasolutions/zod-to-openapi`. Interactive API docs served at `/docs` via `@scalar/express-api-reference`. Spec artifact committed at `openapi.json` and validated in CI.
  - **Environment validation** — `@t3-oss/env-core` with Zod validates all required env vars at startup; service fails fast on missing or malformed config rather than crashing at first use.
  - **Changesets release pipeline** — versioning, changelog, and Docker image publishing are now driven by changesets. Image tags are semver (e.g. `1.0.0`) rather than generated timestamps.
