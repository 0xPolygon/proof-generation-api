import { expect } from 'chai';
import { describe, it } from 'mocha';

import { getAgent } from './helpers/agent.ts';

const VALID_EVENT_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const VALID_BURN_TX = '0x1a7b6aba7e51344474d4fe722a3969e8c7a863c72329210a0dda80d26c4234b4';

describe('matic exit payload — invalid arguments', function () {
  this.timeout(60000);

  // burnTxHash without 0x prefix — wrong format
  it('should 400 with "Incorrect Burn tx or Event Signature!" for burnTxHash without 0x', async function () {
    const res = await getAgent().get(
      `/api/v1/matic/exit-payload/272ce652e562677a0db65f95d0c0dc1dd11ef6b2099f09acdaf9b831b51f6804?eventSignature=${VALID_EVENT_SIG}`
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('msg', 'Incorrect Burn tx or Event Signature!');
  });

  // Both burnTxHash and eventSignature too short — wrong format
  it('should 400 with "Incorrect Burn tx or Event Signature!" for wrong-length hashes', async function () {
    const res = await getAgent().get(
      '/api/v1/matic/exit-payload/0x272ce652e562?eventSignature=0xdf252ad1be2c89b69c2b068fc378daa95'
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('msg', 'Incorrect Burn tx or Event Signature!');
  });

  // missing eventSignature query param — treated as absent/empty
  it('should 400 with "Invalid burnTxHash or eventSignature!" when eventSignature is missing', async function () {
    const res = await getAgent().get(`/api/v1/matic/exit-payload/${VALID_BURN_TX}`);

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('msg', 'Invalid burnTxHash or eventSignature!');
  });

  // valid args but no matching on-chain data → 404
  it('should 404 for valid args that have no on-chain exit data (tokenIndex=1)', async function () {
    const res = await getAgent().get(
      `${`/api/v1/matic/exit-payload/${VALID_BURN_TX}?eventSignature=${VALID_EVENT_SIG}`}&tokenIndex=1`
    );

    expect(res).property('status', 404);
    expect(res).property('body').property('error', true);
  });
});
