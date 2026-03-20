import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

// Validates that val is a JSON-encoded string array where every URL uses https://.
// This prevents silent degradation from misconfigured protocols: ethers.js
// JsonRpcProvider does not follow 301 redirects and throws event="noNetwork"
// instead of failing loudly when given an http:// endpoint.
const isHttpsJsonStringArray = (val: string, ctx: z.RefinementCtx) => {
  try {
    const parsed = JSON.parse(val);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be a valid JSON string array.'
      });
      return z.NEVER;
    }
    for (const url of parsed as string[]) {
      let u: URL;
      try {
        u = new URL(url);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Contains an invalid URL: "${url}"`
        });
        return z.NEVER;
      }
      if (u.protocol !== 'https:') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          // Log only the origin — never the full URL, which may contain secret tokens.
          message: `Contains a non-HTTPS URL: "${u.origin}". All RPC endpoints must use https://.`
        });
        return z.NEVER;
      }
    }
    return parsed as string[];
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Must be valid JSON.'
    });
    return z.NEVER;
  }
};

// Ref: https://github.com/t3-oss/t3-env/pull/145
const booleanStrings = ['true', 'false', true, false, '1', '0', 'yes', 'no', 'y', 'n', 'on', 'off'];

const BooleanOrBooleanStringSchema = z
  .any()
  .refine((val) => booleanStrings.includes(val), { message: 'must be boolean' })
  .transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const normalized = val.toLowerCase().trim();
      if (['true', 'yes', 'y', '1', 'on'].includes(normalized)) return true;
      if (['false', 'no', 'n', '0', 'off'].includes(normalized)) return false;
      throw new Error(`Invalid boolean string: "${val}"`);
    }
    throw new Error(`Expected boolean or boolean string, got: ${typeof val}`);
  });

// Wrapped in a function so createEnv() — and therefore Zod validation — is
// deferred to the first call of getEnv(). Importing this module has no side
// effects, which means test suites running against TEST_BASE_URL can import
// the full application module graph without requiring service env vars.
function buildEnv() {
  return createEnv({
    server: {
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      NAME: z.string().default('Proof Generation API'),
      PORT: z.coerce.number().default(5000),
      ETHEREUM_RPC: z.string().transform(isHttpsJsonStringArray),
      SEPOLIA_RPC: z.string().transform(isHttpsJsonStringArray),
      MATIC_RPC: z.string().transform(isHttpsJsonStringArray),
      AMOY_RPC: z.string().transform(isHttpsJsonStringArray),
      ZKEVM_MAINNET_URL: z.string(),
      ZKEVM_TESTNET_URL: z.string(),
      ERPC_SECRET_TOKEN: z.string().optional(),
      SENTRY_DSN: z.string().optional(),
      PRETTY_LOGS: BooleanOrBooleanStringSchema.default(false)
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true
  });
}

export type Env = ReturnType<typeof buildEnv>;
let _env: Env | undefined;
export function getEnv(): Env {
  return (_env ??= buildEnv());
}
