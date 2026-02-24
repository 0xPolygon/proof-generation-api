import { expect } from 'chai';
import request from 'supertest';

import { getExpressApp } from '../index.ts';

const app = getExpressApp();

describe('invalid network param tests', function () {
  it('should error 400 for `mainnet` on `v1` block-included endpoint', async function () {
    const res = await request(app).get('/api/v1/mainnet/block-included/3000000');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
  });

  it('should error 400 for `testnet` on `v1` fast-merkle-proof endpoint', async function () {
    const res = await request(app).get(
      '/api/v1/testnet/fast-merkle-proof?start=12345&end=12347&number=12346'
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
  });

  it('should error 400 for `mum` on `v1` exit-payload endpoint', async function () {
    const res = await request(app).get(
      '/api/v1/mum/exit-payload/0x1a7b6aba7e51344474d4fe722a3969e8c7a863c72329210a0dda80d26c4234b4?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
  });

  it('should error 400 for `mainnet` on `v1` all-exit-payloads endpoint', async function () {
    const res = await request(app).get(
      '/api/v1/mainnet/all-exit-payloads/0x54f47c891b460369661e22e27eeb4afbbb5dd792c7c8b48cab758892c14ffe85?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
  });
});
