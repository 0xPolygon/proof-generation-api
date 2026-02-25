import { expect } from 'chai';
import { describe, it } from 'mocha';

import { getAgent } from './helpers/agent.ts';

describe('server health', function () {
  it('server healthcheck responds', async function () {
    // 100ms is tight enough to catch regressions locally; allow more for remote round-trips
    this.timeout(process.env['TEST_BASE_URL'] ? 5000 : 100);

    const res = await getAgent().get('/health-check');

    expect(res).property('status', 200);
  });
});
