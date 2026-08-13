import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

// Validates a single RPC URL. Error messages use the URL origin only —
// never the full URL, which may contain secret tokens in query parameters.
// rpc.polygon.tools is a public endpoint that redirects http:// requests
// with a 301. Ethers never follows redirects — it interprets the non-200
// response as event="noNetwork", making the RPC appear dead when healthy.
// All other RPC hosts (e.g. in-cluster proxies) accept http or https.
const RpcUrlSchema = z.string().superRefine((url, ctx) => {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    ctx.addIssue(`Invalid URL`);
    return;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    ctx.addIssue(`"${u.origin}" must use https:// or http://`);
    return;
  }
  if (u.hostname === 'rpc.polygon.tools' && u.protocol !== 'https:') {
    ctx.addIssue(
      `"${u.origin}" — rpc.polygon.tools requires https:// (http:// triggers a 301 that ethers never follows)`
    );
  }
});

// Parses a JSON-encoded string array of RPC URLs, validating each element
// with RpcUrlSchema. Used as a .transform() callback in the env schema.
const parseRpcUrlArray = (val: string, ctx: z.RefinementCtx) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(val);
  } catch {
    ctx.addIssue('Must be valid JSON.');
    return z.NEVER;
  }
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    ctx.addIssue('Must be a valid JSON string array.');
    return z.NEVER;
  }
  for (const url of parsed as string[]) {
    const result = RpcUrlSchema.safeParse(url);
    if (!result.success) {
      ctx.addIssue(result.error.issues[0]?.message ?? 'Invalid RPC URL');
      return z.NEVER;
    }
  }
  return parsed as string[];
};

// Ref: https://github.com/t3-oss/t3-env/pull/145
const truthyStrings = ['true', 'yes', 'y', '1', 'on'];
const falsyStrings = ['false', 'no', 'n', '0', 'off'];
const booleanStrings = [...truthyStrings, ...falsyStrings, true, false];

const BooleanOrBooleanStringSchema = z
  .any()
  .refine((val) => booleanStrings.includes(val), { message: 'must be boolean' })
  .transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const normalized = val.toLowerCase().trim();
      if (truthyStrings.includes(normalized)) return true;
      if (falsyStrings.includes(normalized)) return false;
      throw new Error(`Invalid boolean string: "${val}"`);
    }
    throw new Error(`Expected boolean or boolean string, got: ${typeof val}`);
  });

// Wrapped in a function so createEnv() — and therefore Zod validation — is
// deferred to the first call of getEnv(). Importing this module has no side
// effects, which means test suites running against TEST_BASE_URL can import
// the full application module graph without requiring service env vars.
function buildEnv() {
  const env = createEnv({
    server: {
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      NAME: z.string().default('Proof Generation API'),
      PORT: z.coerce.number().default(5000),
      ETHEREUM_RPC: z.string().transform(parseRpcUrlArray),
      SEPOLIA_RPC: z.string().transform(parseRpcUrlArray),
      MATIC_RPC: z.string().transform(parseRpcUrlArray),
      AMOY_RPC: z.string().transform(parseRpcUrlArray),
      ERPC_SECRET_TOKEN: z.string().optional(),
      SENTRY_DSN: z.string().optional(),
      PRETTY_LOGS: BooleanOrBooleanStringSchema.default(false)
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true
  });

  // The retry logic indexes each coupled pair by the same index (index n = same provider
  // on both sides). Mismatched lengths mean some retries will silently skip due to
  // undefined entries, so exhausting retries without ever trying all providers.
  if (env.ETHEREUM_RPC.length !== env.MATIC_RPC.length) {
    throw new Error(
      `ETHEREUM_RPC and MATIC_RPC must have the same number of entries ` +
        `(got ${env.ETHEREUM_RPC.length} and ${env.MATIC_RPC.length}). ` +
        `Index n in each array must be endpoints from the same provider.`
    );
  }
  if (env.SEPOLIA_RPC.length !== env.AMOY_RPC.length) {
    throw new Error(
      `SEPOLIA_RPC and AMOY_RPC must have the same number of entries ` +
        `(got ${env.SEPOLIA_RPC.length} and ${env.AMOY_RPC.length}). ` +
        `Index n in each array must be endpoints from the same provider.`
    );
  }

  return env;
}

export type Env = ReturnType<typeof buildEnv>;
let _env: Env | undefined;
export function getEnv(): Env {
  return (_env ??= buildEnv());
}
