import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const isJsonStringArray = (val: string, ctx: z.RefinementCtx) => {
  const varName = ctx.path[ctx.path.length - 1];
  try {
    const parsed = JSON.parse(val);
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string')
    ) {
      return parsed as string[];
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${varName} was not set to a valid JSON string array.`,
    });
    return z.NEVER;
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${varName} was not set to valid JSON.`,
    });
    return z.NEVER;
  }
};

// Ref: https://github.com/t3-oss/t3-env/pull/145
const booleanStrings = [
  'true',
  'false',
  true,
  false,
  '1',
  '0',
  'yes',
  'no',
  'y',
  'n',
  'on',
  'off',
];

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

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    NAME: z.string().default('Proof Generation API'),
    PORT: z.coerce.number().default(5000),
    ETHEREUM_RPC: z.string().transform(isJsonStringArray),
    SEPOLIA_RPC: z.string().transform(isJsonStringArray),
    MATIC_RPC: z.string().transform(isJsonStringArray),
    AMOY_RPC: z.string().transform(isJsonStringArray),
    ZKEVM_MAINNET_URL: z.string(),
    ZKEVM_TESTNET_URL: z.string(),
    ERPC_SECRET_TOKEN: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    PRETTY_LOGS: BooleanOrBooleanStringSchema.default(false),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
