import { expect } from 'chai';
import request from 'supertest';

import { getExpressApp } from '../index.ts';

const app = getExpressApp();

describe('server health', function () {
  it('server healthcheck responds', async function () {
    this.timeout(100);

    const res = await request(app).get('/health-check');

    expect(res).property('status', 200);
  });
});
