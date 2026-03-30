import type { Logger } from '../logger.ts';

import { config } from '../config.ts';
import { ZKEVMServiceError } from '../errors.ts';

function getBridgeAPIUrl(network: string) {
  switch (network) {
    case 'mainnet':
    case 'cherry':
      return config.app.zkEVMMainnetURL;
    case 'testnet':
    case 'cardona':
      return config.app.zkEVMTestnetURL;
    default:
      return config.app.zkEVMMainnetURL;
  }
}

export async function bridge(
  networkID: number,
  depositCount: number,
  network: string,
  logger: Logger
) {
  const zkEVMURL = getBridgeAPIUrl(network);

  const response = await fetch(
    `${zkEVMURL}/bridge?net_id=${networkID}&deposit_cnt=${depositCount}`
  );
  const data: any = await response.json();

  if (response.status !== 200) {
    logger.warn(
      { url: zkEVMURL, networkID, depositCount, status: response.status },
      'zkEVM bridge returned non-200'
    );
    // skipCauseMessage (WError semantics): the cause carries the upstream status
    // and message for the logger; the outer message stays clean for the HTTP response.
    throw new ZKEVMServiceError('zkEVM bridge request failed', {
      cause: new Error(`HTTP ${response.status}: ${String(data.message ?? 'no message')}`),
      skipCauseMessage: true
    });
  }
  return data;
}

export async function merkelProofGenerator(
  networkID: number,
  depositCount: number,
  network: string,
  logger: Logger
) {
  const zkEVMURL = getBridgeAPIUrl(network);

  const response = await fetch(
    `${zkEVMURL}/merkle-proof?net_id=${networkID}&deposit_cnt=${depositCount}`
  );
  const data: any = await response.json();

  if (response.status !== 200) {
    logger.warn(
      { url: zkEVMURL, networkID, depositCount, status: response.status },
      'zkEVM merkle-proof returned non-200'
    );
    // skipCauseMessage (WError semantics): the cause carries the upstream status
    // and message for the logger; the outer message stays clean for the HTTP response.
    throw new ZKEVMServiceError('zkEVM bridge request failed', {
      cause: new Error(`HTTP ${response.status}: ${String(data.message ?? 'no message')}`),
      skipCauseMessage: true
    });
  }
  return data;
}
