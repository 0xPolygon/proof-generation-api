import { describe, expect, it } from 'vitest';

import { getAgent } from './helpers/agent.ts';

describe('server health', () => {
  it(
    'server healthcheck responds',
    { timeout: process.env['TEST_BASE_URL'] ? 5000 : 100 },
    async () => {
      const res = await getAgent().get('/health-check');

      expect(res).property('status', 200);
    }
  );
});
