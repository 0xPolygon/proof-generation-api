import { expect } from 'chai';
import { describe, it } from 'mocha';

import { getAgent } from './helpers/agent.ts';

describe('zkEVM endpoints', function () {
  this.timeout(30000);

  it('zkEVM mainnet bridge — deposit lookup', async function () {
    const res = await getAgent().get('/api/zkevm/mainnet/bridge?net_id=1&deposit_cnt=1');

    expect(res).property('status', 200);
    expect(res.body).to.have.property('deposit');
    expect(res.body.deposit).to.have.property(
      'tx_hash',
      '0xb07cd0b30019c78c0b60e464c7c38a0a8076a355dbe9177205573e86455f31b6'
    );
    expect(res.body.deposit).to.have.property('deposit_cnt', 1);
    expect(res.body.deposit).to.have.property('ready_for_claim', true);
  });

  it('zkEVM mainnet merkle-proof — deposit lookup', async function () {
    const res = await getAgent().get('/api/zkevm/mainnet/merkle-proof?net_id=1&deposit_cnt=1');

    expect(res).property('status', 200);
    expect(res.body).to.have.property('proof');
    expect(res.body.proof)
      .to.have.property('merkle_proof')
      .that.is.an('array')
      .with.length.greaterThan(0);
    expect(res.body.proof).to.have.property('rollup_merkle_proof').that.is.an('array');
  });

  it('should 400 with correct message for invalid network on zkEVM bridge', async function () {
    const res = await getAgent().get('/api/zkevm/polygon/bridge?net_id=1&deposit_cnt=1');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res)
      .property('body')
      .property(
        'msg',
        'Invalid network polygon. Network can either be mainnet, testnet, cherry or cardona for zkEVM routes'
      );
  });

  it('should 400 with correct message for invalid network on zkEVM merkle-proof', async function () {
    const res = await getAgent().get('/api/zkevm/polygon/merkle-proof?net_id=1&deposit_cnt=1');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res)
      .property('body')
      .property(
        'msg',
        'Invalid network polygon. Network can either be mainnet, testnet, cherry or cardona for zkEVM routes'
      );
  });

  it('should 400 with correct message for non-integer deposit_cnt', async function () {
    const res = await getAgent().get('/api/zkevm/mainnet/merkle-proof?net_id=1&deposit_cnt=abc');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('msg', 'Invalid network ID or deposit count!');
  });

  it('should 400 with correct message for float deposit_cnt', async function () {
    const res = await getAgent().get('/api/zkevm/mainnet/bridge?net_id=1&deposit_cnt=1.5');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('msg', 'Invalid network ID or deposit count!');
  });

  it('should 400 with correct message for non-integer net_id', async function () {
    const res = await getAgent().get('/api/zkevm/mainnet/bridge?net_id=abc&deposit_cnt=1');

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('msg', 'Invalid network ID or deposit count!');
  });
});
