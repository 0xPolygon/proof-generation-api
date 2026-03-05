import request from 'supertest';

import { getExpressApp } from '../../index.ts';
import { testEnv } from './test-env.ts';

/**
 * Returns a supertest agent that targets either:
 *   - the local in-process Express app (default), or
 *   - a remote base URL when TEST_BASE_URL is set
 *
 * Example — run the full suite against production:
 *   TEST_BASE_URL=https://proof-generator.polygon.technology npm test
 *
 * When targeting a remote URL, a persistent agent is used so that a
 * User-Agent header is sent on every request (Cloudflare drops requests
 * that have no User-Agent).
 */
export function getAgent(): ReturnType<typeof request> {
  const baseUrl = testEnv.TEST_BASE_URL;
  if (baseUrl) {
    return request.agent(baseUrl).set('User-Agent', 'proof-generation-api-tests/1.0');
  }
  return request(getExpressApp());
}
