import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createLogger } from '@polygonlabs/logger';

import { getExpressApp } from '../index.ts';
import { testEnv } from './helpers/test-env.ts';

const LogLineSchema = z.object({
  level: z.string(),
  requestId: z.string().optional(),
  err: z.object({ type: z.string(), message: z.string() }).optional()
});

// A request whose body fails JSON parsing errors inside json(), before any route runs.
// The error handler used to dereference a request logger that did not exist yet, so it
// threw and Express printed that TypeError as multi-line plain text on stderr.
describe.skipIf(testEnv.TEST_BASE_URL)('central error handler', () => {
  let lines: string[] = [];
  let app!: ReturnType<typeof getExpressApp>;

  beforeEach(async () => {
    lines = [];
    app = getExpressApp(await createLogger({ destination: { write: (l) => lines.push(l) } }));
  });

  it('answers a malformed JSON body with 400 and logs it as structured JSON', async () => {
    const res = await request(app)
      .post('/api/v1/matic/block-included/1')
      .set('Content-Type', 'application/json')
      .send('{"a":');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);

    const parsed = lines.map((l) => LogLineSchema.parse(JSON.parse(l)));
    const errLines = parsed.filter((l) => l.err !== undefined);
    expect(errLines).length(1);
    expect(errLines[0]).property('level', 'debug');
    expect(errLines[0]).property('requestId').a('string');
    expect(errLines[0]).nested.property('err.type', 'SyntaxError');
    expect(parsed.filter((l) => l.level === 'error')).length(0);
  });
});
