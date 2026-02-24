import { expect } from 'chai';
import request from 'supertest';

import { getExpressApp } from '../index.ts';

const app = getExpressApp();

// Immutable data from the burn transaction receipt (Polygon chain, never changes):
//   WETH child contract:  0xb6509cbd9e2d1cec787a7357eb1578b86a0c702d
//   Transfer event topic: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
//   Amount (10 WETH):     0x8ac7230489e80000
//
// The Ethereum receipts-trie Merkle path embedded in the payload is NOT pinned
// here because it shifts with each new Ethereum block / RPC provider.

describe('matic exit payload — ERC-20', function () {
  this.timeout(60000);

  it('exit payload test', async function () {
    const res = await request(app).get(
      '/api/v1/matic/exit-payload/0x1a7b6aba7e51344474d4fe722a3969e8c7a863c72329210a0dda80d26c4234b4?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    );

    expect(res).property('status', 200);
    const result: string = res.body.result;
    expect(result).to.match(/^0x[0-9a-f]+$/i);
    expect(result.length).to.be.greaterThan(2000);
    // Burn tx receipt — immutable Polygon data:
    expect(result).to.include('b6509cbd9e2d1cec787a7357eb1578b86a0c702d'); // WETH contract
    expect(result).to.include(
      'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    ); // Transfer sig
    expect(result).to.include('8ac7230489e80000'); // amount: 10 WETH
  });

  it('exit payload with tokenIndex argument test', async function () {
    const res = await request(app).get(
      '/api/v1/matic/exit-payload/0x1a7b6aba7e51344474d4fe722a3969e8c7a863c72329210a0dda80d26c4234b4?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef&tokenIndex=0',
    );

    expect(res).property('status', 200);
    const result: string = res.body.result;
    expect(result).to.match(/^0x[0-9a-f]+$/i);
    expect(result.length).to.be.greaterThan(2000);
    // Same burn tx, same receipt — same immutable content:
    expect(result).to.include('b6509cbd9e2d1cec787a7357eb1578b86a0c702d');
    expect(result).to.include(
      'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    );
    expect(result).to.include('8ac7230489e80000');
  });
});
