import { describe, expect, it } from 'vitest';

import { getAgent } from './helpers/agent.ts';

describe('merkle proof generation', { timeout: 30_000 }, () => {
  it('should return the expected proof result for a known block', async () => {
    const res = await getAgent().get(
      '/api/v1/matic/fast-merkle-proof?start=12345&end=12347&number=12346'
    );

    expect(res).property('status', 200);
    expect(res)
      .property('body')
      .property(
        'proof',
        '0xc62218dfcdc47711e777e6036806592cac1e079f55e2f8f30e6b165bf8737d163643be7c8414f4fc0cfebecce5ba6c663dfbcd74359e3847a429c268777342bb'
      );
  });

  it('should 400 with correct message for a float start block number', async () => {
    const res = await getAgent().get(
      '/api/v1/matic/fast-merkle-proof?start=12324.56&end=12347&number=12346'
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('msg', 'Invalid start, end or block number!');
  });

  it('should 400 with correct message for a non-numeric start block number', async () => {
    const res = await getAgent().get(
      '/api/v1/matic/fast-merkle-proof?start=abc&end=12347&number=12346'
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('msg', 'Invalid start, end or block number!');
  });

  it('should 400 with correct message when number > end', async () => {
    const res = await getAgent().get(
      '/api/v1/matic/fast-merkle-proof?start=12345&end=12347&number=12348'
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('msg', 'Invalid start or end or block numbers!');
  });

  it('should 400 with correct message when end < start', async () => {
    const res = await getAgent().get(
      '/api/v1/matic/fast-merkle-proof?start=12348&end=12347&number=12347'
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('msg', 'Invalid start or end or block numbers!');
  });

  it('should 400 with correct message when number < start', async () => {
    const res = await getAgent().get(
      '/api/v1/matic/fast-merkle-proof?start=12346&end=12347&number=12344'
    );

    expect(res).property('status', 400);
    expect(res).property('body').property('error', true);
    expect(res).property('body').property('msg', 'Invalid start or end or block numbers!');
  });
});
