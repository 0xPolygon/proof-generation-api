import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Logger } from '../logger.ts';

import { getExpressApp } from '../index.ts';
import { MAX_IN_FLIGHT_EXIT_PAYLOADS } from '../inFlightCap.ts';

const TX = `0x${'1'.repeat(64)}`;
const SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Mock at the service boundary so each "exit payload build" can be held open or failed
// on demand. The router, cap middleware and central error handler run for real.
const mocks = vi.hoisted(() => ({
  generateExitPayload: vi.fn(),
  generateAllExitPayloads: vi.fn(),
  isBlockIncluded: vi.fn(),
  fastMerkleProof: vi.fn()
}));

vi.mock('../services/v1ProofGenerationServices.ts', () => mocks);

const logger: { child: () => unknown; error: ReturnType<typeof vi.fn> } = {
  child: () => logger,
  error: vi.fn()
};
Object.assign(logger, { debug: vi.fn() });

describe('exit payload in-flight cap', () => {
  let server: ReturnType<ReturnType<typeof getExpressApp>['listen']>;
  let baseUrl!: string;
  let release: Array<() => void> = [];

  // Each call parks until released, like a slow proof build.
  const hold = (): Promise<{ result: string }> =>
    new Promise((resolve) => {
      release.push(() => resolve({ result: '0xpayload' }));
    });

  const exitPayload = (signal?: AbortSignal) =>
    fetch(`${baseUrl}/api/v1/matic/exit-payload/${TX}?eventSignature=${SIG}`, {
      ...(signal && { signal })
    });

  const fillCap = (signal?: AbortSignal) =>
    Array.from({ length: MAX_IN_FLIGHT_EXIT_PAYLOADS }, () => exitPayload(signal));

  // Wait until the service has been entered by n requests, i.e. the cap has counted them.
  const untilInFlight = (n: number) =>
    vi.waitFor(() => expect(mocks.generateExitPayload.mock.calls.length).to.be.at.least(n));

  beforeAll(async () => {
    server = getExpressApp(logger as unknown as Logger).listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    // Finish anything a previous test left in flight so its slots are freed.
    release.forEach((fn) => fn());
    release = [];
    vi.clearAllMocks();
    mocks.generateExitPayload.mockImplementation(hold);
    mocks.generateAllExitPayloads.mockImplementation(hold);
    mocks.isBlockIncluded.mockResolvedValue({ message: 'ok' });
  });

  it('rejects the request after the cap with 503 and Retry-After, and admits it again once one finishes', async () => {
    const admitted = fillCap();
    await untilInFlight(MAX_IN_FLIGHT_EXIT_PAYLOADS);

    const rejected = await exitPayload();
    expect(rejected).property('status', 503);
    expect(rejected.headers.get('retry-after')).to.match(/^\d+$/);
    expect(await rejected.json()).to.deep.equal({
      error: true,
      message: 'Server is busy, please retry shortly'
    });
    expect(mocks.generateExitPayload).toHaveBeenCalledTimes(MAX_IN_FLIGHT_EXIT_PAYLOADS);
    expect(logger.error).not.toHaveBeenCalled();

    release.shift()?.();
    await (await admitted[0])?.text();

    mocks.generateExitPayload.mockResolvedValue({ result: '0xok' });
    expect(await exitPayload()).property('status', 200);

    release.forEach((fn) => fn());
    await Promise.all(admitted);
  });

  it('shares one counter between exit-payload and all-exit-payloads', async () => {
    const admitted = fillCap();
    await untilInFlight(MAX_IN_FLIGHT_EXIT_PAYLOADS);

    const res = await fetch(
      `${baseUrl}/api/v1/matic/all-exit-payloads/${TX}?eventSignature=${SIG}`
    );

    expect(res).property('status', 503);
    expect(mocks.generateAllExitPayloads).toHaveBeenCalledTimes(0);

    release.forEach((fn) => fn());
    await Promise.all(admitted);
  });

  it('frees slots when builds error', async () => {
    mocks.generateExitPayload.mockRejectedValue(new Error('rpc down'));

    // Twice the cap, one after another: a leaked slot per error would trip the cap partway.
    for (let i = 0; i < 2 * MAX_IN_FLIGHT_EXIT_PAYLOADS; i++) {
      expect(await exitPayload()).property('status', 500);
    }

    mocks.generateExitPayload.mockResolvedValue({ result: '0xok' });
    expect(await exitPayload()).property('status', 200);
  });

  it('frees slots when clients abort', async () => {
    const controller = new AbortController();
    const aborted = fillCap(controller.signal).map((p) => p.catch(() => undefined));
    await untilInFlight(MAX_IN_FLIGHT_EXIT_PAYLOADS);

    controller.abort();
    await Promise.all(aborted);

    mocks.generateExitPayload.mockResolvedValue({ result: '0xok' });
    // Server-side close events arrive asynchronously after the client disconnects.
    await vi.waitFor(async () => expect(await exitPayload()).property('status', 200));
  });

  it('does not cap other routes while the exit-payload cap is full', async () => {
    const admitted = fillCap();
    await untilInFlight(MAX_IN_FLIGHT_EXIT_PAYLOADS);

    expect(await fetch(`${baseUrl}/health-check`)).property('status', 200);
    const blockIncluded = await fetch(`${baseUrl}/api/v1/matic/block-included/100`);
    expect(blockIncluded).property('status', 200);

    release.forEach((fn) => fn());
    await Promise.all(admitted);
  });
});
