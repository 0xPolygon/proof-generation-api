import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Logger } from '../logger.ts';

import { BlockNotIncludedError, UpstreamRpcError } from '../errors.ts';
import {
  generateAllExitPayloads,
  generateExitPayload
} from '../services/v1ProofGenerationServices.ts';

const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_TOPIC = `0x${'0'.repeat(64)}`;
const TX = `0x${'1'.repeat(64)}`;

// Narrowest boundary: the maticjs client. Everything in the service's own
// retry/classification logic runs for real.
const mocks = vi.hoisted(() => ({
  RPC_COUNT: 2,
  isCheckPointed: vi.fn(),
  buildPayloadForExit: vi.fn(),
  buildMultiplePayloadsForExit: vi.fn(),
  getTransactionReceipt: vi.fn()
}));

vi.mock('../config.ts', () => {
  const urls = Array.from({ length: mocks.RPC_COUNT }, (_, i) => `http://rpc-${i}.invalid`);
  return {
    config: {
      app: { ethereumRPC: urls, sepoliaRPC: urls, maticRPC: urls, amoyRPC: urls },
      mainnetRpcIndex: 0,
      testnetRpcIndex: 0
    }
  };
});

vi.mock('../maticClient.ts', () => ({
  convert: vi.fn(),
  initMatic: vi.fn(() =>
    Promise.resolve({
      client: { child: { getTransactionReceipt: mocks.getTransactionReceipt } },
      exitUtil: {
        isCheckPointed: mocks.isCheckPointed,
        buildPayloadForExit: mocks.buildPayloadForExit,
        buildMultiplePayloadsForExit: mocks.buildMultiplePayloadsForExit
      }
    })
  )
}));

// Only warn() is called by the retry loop.
const logger = { warn: vi.fn() } as unknown as Logger;

const burnLog = { topics: [TRANSFER_SIG, ZERO_TOPIC, ZERO_TOPIC] };
const unrelatedLog = { topics: ['0xabc', ZERO_TOPIC, ZERO_TOPIC] };

describe('exit payload fail-fast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isCheckPointed.mockResolvedValue(true);
    mocks.getTransactionReceipt.mockResolvedValue({ logs: [burnLog] });
  });

  it('does not retry a maticjs "Log not found in receipt" error and returns 404', async () => {
    mocks.buildPayloadForExit.mockRejectedValue(new Error('Log not found in receipt'));

    const err = await generateExitPayload(TX, TRANSFER_SIG, 0, true, 'v1', logger).catch(
      (e: unknown) => e
    );

    expect(err).instanceOf(BlockNotIncludedError);
    expect(err).property('statusCode', 404);
    expect(mocks.buildPayloadForExit).toHaveBeenCalledTimes(1);
  });

  it('does not retry "Log not found in receipt" for all-exit-payloads either', async () => {
    mocks.buildMultiplePayloadsForExit.mockRejectedValue(new Error('Log not found in receipt'));

    const err = await generateAllExitPayloads(TX, TRANSFER_SIG, true, 'v1', logger).catch(
      (e: unknown) => e
    );

    expect(err).property('statusCode', 404);
    expect(mocks.buildMultiplePayloadsForExit).toHaveBeenCalledTimes(1);
  });

  it('reports exhausted transient failures as 5xx, not "log not found"', async () => {
    mocks.buildPayloadForExit.mockRejectedValue(new Error('timeout of 120000ms exceeded'));

    const err = await generateExitPayload(TX, TRANSFER_SIG, 0, true, 'v1', logger).catch(
      (e: unknown) => e
    );

    expect(err).instanceOf(UpstreamRpcError);
    expect(err).property('statusCode', 502);
    expect(mocks.buildPayloadForExit).toHaveBeenCalledTimes(2 * mocks.RPC_COUNT);
  });

  it('stops retrying once the retry time budget is spent', async () => {
    // Each failed attempt "takes" 15s, so the 20s budget is spent after two attempts.
    let now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    mocks.buildPayloadForExit.mockImplementation(() => {
      now += 15_000;
      return Promise.reject(new Error('timeout'));
    });

    const err = await generateExitPayload(TX, TRANSFER_SIG, 0, true, 'v1', logger).catch(
      (e: unknown) => e
    );
    clock.mockRestore();

    expect(err).instanceOf(UpstreamRpcError);
    expect(mocks.buildPayloadForExit).toHaveBeenCalledTimes(2);
  });

  it('rejects a receipt with no matching log without building the proof', async () => {
    mocks.getTransactionReceipt.mockResolvedValue({ logs: [unrelatedLog] });

    const err = await generateExitPayload(TX, TRANSFER_SIG, 0, true, 'v1', logger).catch(
      (e: unknown) => e
    );

    expect(err).property('statusCode', 404);
    expect(mocks.buildPayloadForExit).toHaveBeenCalledTimes(0);
  });

  it('rejects an out-of-range tokenIndex without building the proof', async () => {
    const err = await generateExitPayload(TX, TRANSFER_SIG, 1, true, 'v1', logger).catch(
      (e: unknown) => e
    );

    expect(err).property('statusCode', 404);
    expect(mocks.buildPayloadForExit).toHaveBeenCalledTimes(0);
  });

  it('does not treat a Transfer that is not a burn (non-zero recipient) as a match', async () => {
    mocks.getTransactionReceipt.mockResolvedValue({
      logs: [{ topics: [TRANSFER_SIG, ZERO_TOPIC, `0x${'2'.repeat(64)}`] }]
    });

    const err = await generateAllExitPayloads(TX, TRANSFER_SIG, true, 'v1', logger).catch(
      (e: unknown) => e
    );

    expect(err).property('statusCode', 404);
    expect(mocks.buildMultiplePayloadsForExit).toHaveBeenCalledTimes(0);
  });

  it('still builds the proof when a matching log exists', async () => {
    mocks.buildPayloadForExit.mockResolvedValue('0xpayload');

    const res = await generateExitPayload(TX, TRANSFER_SIG, 0, true, 'v1', logger);

    expect(res).property('result', '0xpayload');
    expect(mocks.buildPayloadForExit).toHaveBeenCalledTimes(1);
  });
});
