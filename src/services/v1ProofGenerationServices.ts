import type { BigNumber } from 'ethers';

import { Contract } from 'ethers';

import { POSBridgeError } from '@polygonlabs/maticjs';
import { RootChainABI } from '@polygonlabs/maticjs/abi';
import { HTTPError } from '@polygonlabs/verror';

import type { Logger } from '../logger.ts';

import { config } from '../config.ts';
import {
  BlockNotIncludedError,
  IncorrectTxError,
  TxNotCheckpointedError,
  UpstreamRpcError
} from '../errors.ts';
import { assertExitLogPresent, toDeterministicError } from '../exitLogs.ts';
import { initMatic } from '../maticClient.ts';

// Returns only the protocol+host of an RPC URL so that secret tokens in query
// params are never written to logs.
function rpcOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '[unparseable URL]';
  }
}

// Health checks and most clients give up at ~30s, so once this budget is spent no new
// attempt is started: the caller gets a prompt failure instead of minutes of retries.
const RETRY_BUDGET_MS = 20_000;

const createIsLastAttempt = (maxRetries: number) => {
  const deadline = Date.now() + RETRY_BUDGET_MS;
  return (attempt: number) => attempt === maxRetries - 1 || Date.now() >= deadline;
};

// RootChain.headerBlocks(uint256) as ethers v5 decodes it. The response forwards these
// fields as-is, so the BigNumbers serialise to the same `{ type: 'BigNumber', hex }`
// JSON the API has always returned.
interface HeaderBlock {
  start: BigNumber;
  end: BigNumber;
  proposer: string;
  root: string;
  createdAt: BigNumber;
}

// POSBridgeError carries a stable `code` plus the legacy 3.x `type` string. Raw
// ethers failures pass through the SDK's read path unwrapped and carry their own
// string `code` (SERVER_ERROR, TIMEOUT, CALL_EXCEPTION) — the bulk of retry warnings
// in prod — so keep logging that too.
const sdkErrorFields = (error: unknown) => {
  if (error instanceof POSBridgeError) return { errorType: error.type, errorCode: error.code };
  const errorCode =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  return { errorType: undefined, errorCode };
};

const getVersionDetails = (version: string) => {
  // RPC lengths read here (not at module scope) so env validation is deferred
  // until the first actual request when running against TEST_BASE_URL.
  const mainnetRPCLength = config.app.maticRPC.length;
  const mainnetMaxRetries = 2 * mainnetRPCLength;
  const testnetAmoyRPCLength = config.app.amoyRPC.length;
  const testnetAmoyMaxRetries = 2 * testnetAmoyRPCLength;

  switch (version) {
    case 'v1':
      return {
        ethereumRPC: config.app.ethereumRPC,
        maticRPC: config.app.maticRPC,
        maxRetries: mainnetMaxRetries,
        rpcLength: mainnetRPCLength
      };
    case 'amoy':
      return {
        ethereumRPC: config.app.sepoliaRPC,
        maticRPC: config.app.amoyRPC,
        maxRetries: testnetAmoyMaxRetries,
        rpcLength: testnetAmoyRPCLength
      };
    default:
      return {
        ethereumRPC: config.app.ethereumRPC,
        maticRPC: config.app.maticRPC,
        maxRetries: mainnetMaxRetries,
        rpcLength: mainnetRPCLength
      };
  }
};

export async function isBlockIncluded(
  blockNumber: string,
  isMainnet: boolean,
  version: string,
  logger: Logger
) {
  const { ethereumRPC, maticRPC, maxRetries, rpcLength } = getVersionDetails(version);
  const isLastAttempt = createIsLastAttempt(maxRetries);
  const initialRpcIndex = isMainnet ? config.mainnetRpcIndex : config.testnetRpcIndex;

  let result;

  for (let i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength;
    const maticRPCUrl = maticRPC[rpcIndex];
    const ethereumRPCUrl = ethereumRPC[rpcIndex];

    if (!maticRPCUrl || !ethereumRPCUrl) {
      continue;
    }

    try {
      const { pos, parentProvider } = await initMatic(
        isMainnet,
        version,
        maticRPCUrl,
        ethereumRPCUrl
      );

      const lastChildBlock = await pos.rootChain.getLastChildBlock();
      if (lastChildBlock >= BigInt(blockNumber)) {
        const headerSlot = await pos.rootChain.findRootBlockFromChild(BigInt(blockNumber));
        const headerBlockNumber = '0x' + headerSlot.toString(16);

        // The SDK has no public headerBlocks read, so call the RootChain contract
        // directly; ethers v5 keeps the BigNumber fields the response has always carried.
        const { RootChain } = await pos.getAddresses();
        const headerBlock: HeaderBlock = await new Contract(
          RootChain,
          RootChainABI,
          parentProvider
        )['headerBlocks'](headerSlot);

        result = {
          headerBlockNumber,
          blockNumber,
          start: headerBlock.start,
          end: headerBlock.end,
          proposer: headerBlock.proposer,
          root: headerBlock.root,
          createdAt: headerBlock.createdAt,
          message: 'success'
        };
      } else {
        throw new BlockNotIncludedError('No block found');
      }

      break;
    } catch (error: unknown) {
      if (error instanceof BlockNotIncludedError || isLastAttempt(i)) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        {
          err,
          blockNumber,
          network: version,
          maticRpcOrigin: rpcOrigin(maticRPCUrl),
          ethereumRpcOrigin: rpcOrigin(ethereumRPCUrl),
          attempt: i + 1,
          maxRetries,
          ...sdkErrorFields(error)
        },
        'RPC attempt failed, retrying'
      );
    }
  }
  return result;
}

export async function fastMerkleProof(
  start: string,
  end: string,
  number: number,
  isMainnet: boolean,
  version: string,
  logger: Logger
) {
  const { ethereumRPC, maticRPC, maxRetries, rpcLength } = getVersionDetails(version);
  const isLastAttempt = createIsLastAttempt(maxRetries);
  const initialRpcIndex = isMainnet ? config.mainnetRpcIndex : config.testnetRpcIndex;

  let proof;

  for (let i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength;
    const maticRPCUrl = maticRPC[rpcIndex];
    const ethereumRPCUrl = ethereumRPC[rpcIndex];

    if (!maticRPCUrl || !ethereumRPCUrl) {
      continue;
    }

    try {
      const { pos } = await initMatic(isMainnet, version, maticRPCUrl, ethereumRPCUrl);
      proof = await pos.getBlockProof(number, { start: Number(start), end: Number(end) });
      break;
    } catch (error: unknown) {
      if (isLastAttempt(i)) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        {
          err,
          blockNumber: number,
          network: version,
          maticRpcOrigin: rpcOrigin(maticRPCUrl),
          ethereumRpcOrigin: rpcOrigin(ethereumRPCUrl),
          attempt: i + 1,
          maxRetries,
          ...sdkErrorFields(error)
        },
        'RPC attempt failed, retrying'
      );
    }
  }
  return { proof };
}

export async function generateExitPayload(
  burnTxHash: string,
  eventSignature: string,
  tokenIndex: number,
  isMainnet: boolean,
  version: string,
  logger: Logger
) {
  const { ethereumRPC, maticRPC, maxRetries, rpcLength } = getVersionDetails(version);
  const isLastAttempt = createIsLastAttempt(maxRetries);
  const initialRpcIndex = isMainnet ? config.mainnetRpcIndex : config.testnetRpcIndex;
  // maticjs matches its burn-event special cases case-sensitively; normalising here keeps
  // the pre-check and the SDK agreeing on which log a mixed-case signature selects.
  const sig = eventSignature.toLowerCase();

  let result;
  let isCheckpointed;

  for (let i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength;
    const maticRPCUrl = maticRPC[rpcIndex];
    const ethereumRPCUrl = ethereumRPC[rpcIndex];

    if (!maticRPCUrl || !ethereumRPCUrl) {
      continue;
    }

    try {
      const { pos, childProvider } = await initMatic(
        isMainnet,
        version,
        maticRPCUrl,
        ethereumRPCUrl
      );

      if (!isCheckpointed) {
        try {
          isCheckpointed = await pos.isCheckpointed(burnTxHash);
        } catch (checkpointError: unknown) {
          const err =
            checkpointError instanceof Error ? checkpointError : new Error(String(checkpointError));
          if (isLastAttempt(i)) {
            throw new IncorrectTxError('Incorrect burn transaction');
          }
          throw err;
        }
        if (!isCheckpointed) {
          throw new TxNotCheckpointedError('Burn transaction has not been checkpointed yet');
        }
      }

      // Cheap rejection before the expensive proof build: maticjs only checks the
      // log after fetching every receipt in the block and building both proofs.
      const receipt = await childProvider.getTransactionReceipt(burnTxHash);
      if (receipt?.logs) {
        assertExitLogPresent({ logs: receipt.logs, eventSignature: sig, tokenIndex });
      }

      try {
        result = await pos.buildExitPayloadOnIndex(burnTxHash, sig, tokenIndex);
      } catch (buildError: unknown) {
        const err = buildError instanceof Error ? buildError : new Error(String(buildError));
        // BlockNotIncludedError extends HTTPError, which is W-by-default (verror
        // 1.1+): the outer message stays clean for the HTTP response automatically;
        // the original maticjs error is preserved in the cause chain for the logger
        // to unwrap.
        const deterministic = toDeterministicError(err);
        if (deterministic) throw deterministic;
        throw err;
      }

      if (!result) {
        throw new Error('buildExitPayloadOnIndex returned no result');
      }

      break;
    } catch (error: unknown) {
      if (error instanceof HTTPError) throw error;
      const err = error instanceof Error ? error : new Error(String(error));
      if (isLastAttempt(i)) {
        throw new UpstreamRpcError('Exit payload generation failed after retries', { cause: err });
      }
      logger.warn(
        {
          err,
          burnTxHash,
          network: version,
          maticRpcOrigin: rpcOrigin(maticRPCUrl),
          ethereumRpcOrigin: rpcOrigin(ethereumRPCUrl),
          attempt: i + 1,
          maxRetries,
          ...sdkErrorFields(error)
        },
        'RPC attempt failed, retrying'
      );
    }
  }
  return { message: 'Payload generation success', result };
}

export async function generateAllExitPayloads(
  burnTxHash: string,
  eventSignature: string,
  isMainnet: boolean,
  version: string,
  logger: Logger
) {
  const { ethereumRPC, maticRPC, maxRetries, rpcLength } = getVersionDetails(version);
  const isLastAttempt = createIsLastAttempt(maxRetries);
  const initialRpcIndex = isMainnet ? config.mainnetRpcIndex : config.testnetRpcIndex;
  // See generateExitPayload: keeps the pre-check and maticjs on the same log selection.
  const sig = eventSignature.toLowerCase();

  let result;
  let isCheckpointed;

  for (let i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength;
    const maticRPCUrl = maticRPC[rpcIndex];
    const ethereumRPCUrl = ethereumRPC[rpcIndex];

    if (!maticRPCUrl || !ethereumRPCUrl) {
      continue;
    }

    try {
      const { pos, childProvider } = await initMatic(
        isMainnet,
        version,
        maticRPCUrl,
        ethereumRPCUrl
      );

      try {
        isCheckpointed = await pos.isCheckpointed(burnTxHash);
      } catch (checkpointError: unknown) {
        if (isLastAttempt(i)) {
          throw new IncorrectTxError('Incorrect burn transaction');
        }
        throw checkpointError instanceof Error
          ? checkpointError
          : new Error(String(checkpointError));
      }
      if (!isCheckpointed) {
        throw new TxNotCheckpointedError('Burn transaction has not been checkpointed yet');
      }

      const receipt = await childProvider.getTransactionReceipt(burnTxHash);
      if (receipt?.logs) {
        assertExitLogPresent({ logs: receipt.logs, eventSignature: sig });
      }

      try {
        result = await pos.buildExitPayloads(burnTxHash, sig);
      } catch (buildError: unknown) {
        const err = buildError instanceof Error ? buildError : new Error(String(buildError));
        const deterministic = toDeterministicError(err);
        if (deterministic) throw deterministic;
        // Rethrow to the outer retry loop, which logs and retries — no need to
        // log here too.
        throw err;
      }

      if (!result) {
        throw new Error('buildExitPayloads returned no result');
      }

      break;
    } catch (error: unknown) {
      if (error instanceof HTTPError) throw error;
      const err = error instanceof Error ? error : new Error(String(error));
      if (isLastAttempt(i)) {
        throw new UpstreamRpcError('Exit payload generation failed after retries', { cause: err });
      }
      logger.warn(
        {
          err,
          burnTxHash,
          network: version,
          maticRpcOrigin: rpcOrigin(maticRPCUrl),
          ethereumRpcOrigin: rpcOrigin(ethereumRPCUrl),
          attempt: i + 1,
          maxRetries,
          ...sdkErrorFields(error)
        },
        'RPC attempt failed, retrying'
      );
    }
  }
  return { message: 'Payload generation success', result };
}
