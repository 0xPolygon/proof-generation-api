import { HTTPError } from '@polygonlabs/verror';

import type { Logger } from '../logger.ts';

import { config } from '../config.ts';
import { BlockNotIncludedError, IncorrectTxError, TxNotCheckpointedError } from '../errors.ts';
import { convert, initMatic } from '../maticClient.ts';

// Returns only the protocol+host of an RPC URL so that secret tokens in query
// params are never written to logs.
function rpcOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '[unparseable URL]';
  }
}

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
      const rootChain = await initMatic(isMainnet, version, maticRPCUrl, ethereumRPCUrl).then(
        (maticClient: any) => {
          return maticClient.exitUtil.rootChain;
        }
      );

      const lastChildBlock = await rootChain.getLastChildBlock();
      if (parseInt(lastChildBlock) >= parseInt(blockNumber)) {
        const headerBlockNumber = await rootChain
          .findRootBlockFromChild(blockNumber)
          .then((res: any) => {
            return convert(res);
          });

        const headerBlock: any = await rootChain
          .method('headerBlocks', headerBlockNumber)
          .then((meth: any) => {
            return meth.read();
          });

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
      if (error instanceof BlockNotIncludedError || i === maxRetries - 1) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      const maticjsErr = error as Record<string, unknown>;
      logger.warn(
        {
          err,
          blockNumber,
          network: version,
          maticRpcOrigin: rpcOrigin(maticRPCUrl),
          ethereumRpcOrigin: rpcOrigin(ethereumRPCUrl),
          attempt: i + 1,
          maxRetries,
          errorEvent: maticjsErr['event'],
          errorCode: maticjsErr['code']
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
      const maticClient = await initMatic(isMainnet, version, maticRPCUrl, ethereumRPCUrl);
      proof = await maticClient.exitUtil.getBlockProof(number, { start, end });
      break;
    } catch (error: unknown) {
      if (i === maxRetries - 1) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      const maticjsErr = error as Record<string, unknown>;
      logger.warn(
        {
          err,
          blockNumber: number,
          network: version,
          maticRpcOrigin: rpcOrigin(maticRPCUrl),
          ethereumRpcOrigin: rpcOrigin(ethereumRPCUrl),
          attempt: i + 1,
          maxRetries,
          errorEvent: maticjsErr['event'],
          errorCode: maticjsErr['code']
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
  const initialRpcIndex = isMainnet ? config.mainnetRpcIndex : config.testnetRpcIndex;

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
      const maticClient = await initMatic(isMainnet, version, maticRPCUrl, ethereumRPCUrl);

      if (!isCheckpointed) {
        try {
          isCheckpointed = await maticClient.exitUtil.isCheckPointed(burnTxHash);
        } catch (checkpointError: unknown) {
          const err =
            checkpointError instanceof Error ? checkpointError : new Error(String(checkpointError));
          logger.warn({ err, burnTxHash, network: version }, 'checkpoint status check failed');
          if (i === maxRetries - 1) {
            throw new IncorrectTxError('Incorrect burn transaction');
          }
          throw err;
        }
        if (!isCheckpointed) {
          throw new TxNotCheckpointedError('Burn transaction has not been checkpointed yet');
        }
      }

      try {
        result = await maticClient.exitUtil.buildPayloadForExit(
          burnTxHash,
          eventSignature,
          false,
          tokenIndex
        );
      } catch (buildError: unknown) {
        const err = buildError instanceof Error ? buildError : new Error(String(buildError));
        if (err.message === 'Index is greater than the number of tokens in this transaction') {
          // skipCauseMessage (WError semantics): the outer message stays clean for
          // the HTTP response; the original maticjs error is preserved in the cause
          // chain for the logger to unwrap.
          throw new BlockNotIncludedError('Token index out of range for this transaction', {
            cause: err,
            skipCauseMessage: true
          });
        }
        if (i === maxRetries - 1) {
          throw new BlockNotIncludedError('Event Signature log not found in tx receipt');
        }
        throw err;
      }

      if (!result) {
        throw new Error('buildPayloadForExit returned no result');
      }

      break;
    } catch (error: unknown) {
      if (error instanceof HTTPError || i === maxRetries - 1) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      const maticjsErr = error as Record<string, unknown>;
      logger.warn(
        {
          err,
          burnTxHash,
          network: version,
          maticRpcOrigin: rpcOrigin(maticRPCUrl),
          ethereumRpcOrigin: rpcOrigin(ethereumRPCUrl),
          attempt: i + 1,
          maxRetries,
          errorEvent: maticjsErr['event'],
          errorCode: maticjsErr['code']
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
  const initialRpcIndex = isMainnet ? config.mainnetRpcIndex : config.testnetRpcIndex;

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
      const maticClient = await initMatic(isMainnet, version, maticRPCUrl, ethereumRPCUrl);

      try {
        isCheckpointed = await maticClient.exitUtil.isCheckPointed(burnTxHash);
      } catch (checkpointError: unknown) {
        if (i === maxRetries - 1) {
          throw new IncorrectTxError('Incorrect burn transaction');
        }
        throw checkpointError instanceof Error
          ? checkpointError
          : new Error(String(checkpointError));
      }
      if (!isCheckpointed) {
        throw new TxNotCheckpointedError('Burn transaction has not been checkpointed yet');
      }

      try {
        result = await maticClient.exitUtil.buildMultiplePayloadsForExit(
          burnTxHash,
          eventSignature,
          false
        );
      } catch (buildError: unknown) {
        const err = buildError instanceof Error ? buildError : new Error(String(buildError));
        if (i === maxRetries - 1) {
          throw new BlockNotIncludedError('Event Signature log not found in tx receipt');
        }
        // Rethrow to the outer retry loop, which logs and retries — no need to
        // log here too.
        throw err;
      }

      if (!result) {
        throw new Error('buildMultiplePayloadsForExit returned no result');
      }

      break;
    } catch (error: unknown) {
      if (error instanceof HTTPError || i === maxRetries - 1) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      const maticjsErr = error as Record<string, unknown>;
      logger.warn(
        {
          err,
          burnTxHash,
          network: version,
          maticRpcOrigin: rpcOrigin(maticRPCUrl),
          ethereumRpcOrigin: rpcOrigin(ethereumRPCUrl),
          attempt: i + 1,
          maxRetries,
          errorEvent: maticjsErr['event'],
          errorCode: maticjsErr['code']
        },
        'RPC attempt failed, retrying'
      );
    }
  }
  return { message: 'Payload generation success', result };
}
