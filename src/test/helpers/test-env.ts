import { z } from 'zod';

const TestEnvSchema = z.object({
  TEST_BASE_URL: z.string().url().optional()
});

export const testEnv = TestEnvSchema.parse({
  TEST_BASE_URL: process.env['TEST_BASE_URL']
});
