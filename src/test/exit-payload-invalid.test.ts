import { expect } from 'chai';
import request from 'supertest';

import { getExpressApp } from '../index.ts';

const app = getExpressApp();

describe('matic exit payload — invalid arguments', function () {
  this.timeout(60000);

  it('invalid exit payload arguments test - 1', async function () {
    const res = await request(app).get(
      '/api/v1/matic/exit-payload/272ce652e562677a0db65f95d0c0dc1dd11ef6b2099f09acdaf9b831b51f6804?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
  });

  it('invalid exit payload arguments test - 2', async function () {
    const res = await request(app).get(
      '/api/v1/matic/exit-payload/0x272ce652e562?eventSignature=0xdf252ad1be2c89b69c2b068fc378daa95',
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
  });

  it('invalid exit payload arguments test - 3', async function () {
    const res = await request(app).get(
      '/api/v1/matic/exit-payload/0x1a7b6aba7e51344474d4fe722a3969e8c7a863c72329210a0dda80d26c4234b4?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef&tokenIndex=1',
    );

    expect(res).property('status', 404);
    expect(res).property('body').property('error', true);
  });
});
