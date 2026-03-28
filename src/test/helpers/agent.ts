import request from 'supertest';

import { getExpressApp } from '../../index.ts';
import { createLogger } from '../../logger.ts';
import { testEnv } from './test-env.ts';

// Initialise the local Express app once per test file.
// Guarded by TEST_BASE_URL so that createLogger() — and the env validation
// it triggers — is never called when tests target a remote server.
const localApp = testEnv.TEST_BASE_URL ? null : getExpressApp(await createLogger());

export function getAgent(): ReturnType<typeof request> {
  const baseUrl = testEnv.TEST_BASE_URL;
  if (baseUrl) {
    return request.agent(baseUrl).set('User-Agent', 'proof-generation-api-tests/1.0');
  }
  if (!localApp) throw new Error('localApp not initialised');
  return request(localApp);
}
