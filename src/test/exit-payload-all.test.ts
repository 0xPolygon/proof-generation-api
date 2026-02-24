import { expect } from 'chai';
import request from 'supertest';

import { getExpressApp } from '../index.ts';

const app = getExpressApp();

describe('matic exit payload — all-exit-payloads', function () {
  this.timeout(60000);

  it('erc721 all exit payloads test', async function () {
    const res = await request(app).get(
      '/api/v1/matic/all-exit-payloads/0xdc3e4c2d41edd8c0a059be22aaa48ee6649f3688456db234b7e382e1cf735b50?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    );

    expect(res).property('status', 200);
    expect(res).property('body').property('result').property('length', 1);
  });
});
