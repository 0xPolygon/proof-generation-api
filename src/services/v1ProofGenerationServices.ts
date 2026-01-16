import { config } from '../config.ts';
import { errorTypes } from '../constants.ts';
import { InfoError } from '../helpers/errorHelper.ts';
import { initMatic, convert } from '../helpers/maticClient.ts';
import { getLogger } from '../logger.ts';

const logger = getLogger();

const mainnetRPCLength = config.app.maticRPC.length; // total mainnet rpcs
const mainnetMaxRetries = 2 * mainnetRPCLength; // max mainnet retries
const testnetAmoyRPCLength = config.app.amoyRPC.length; // total amoy testnet rpcs
const testnetAmoyMaxRetries = 2 * testnetAmoyRPCLength; // max amoy testnet retries

const getVersionDetails = (version: string) => {
  switch (version) {
    case 'v1':
      return {
        ethereumRPC: config.app.ethereumRPC,
        maticRPC: config.app.maticRPC,
        maxRetries: mainnetMaxRetries,
        rpcLength: mainnetRPCLength,
      };
    case 'amoy':
      return {
        ethereumRPC: config.app.sepoliaRPC,
        maticRPC: config.app.amoyRPC,
        maxRetries: testnetAmoyMaxRetries,
        rpcLength: testnetAmoyRPCLength,
      };
    default:
      return {
        ethereumRPC: config.app.ethereumRPC,
        maticRPC: config.app.maticRPC,
        maxRetries: mainnetMaxRetries,
        rpcLength: mainnetRPCLength,
      };
  }
};

/**
 * isBlockIncluded
 *
 * @param {String} blockNumber
 * @param {Boolean} isMainnet
 * @param {String} version
 * @returns {Object}
 */
export async function isBlockIncluded(
  blockNumber: string,
  isMainnet: boolean,
  version: string,
) {
  const { ethereumRPC, maticRPC, maxRetries, rpcLength } =
    getVersionDetails(version);
  const initialRpcIndex = isMainnet
    ? config.mainnetRpcIndex
    : config.testnetRpcIndex;

  let result;

  // loop over rpcs to retry in case of an rpc error
  for (let i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength;
    const maticRPCUrl = maticRPC[rpcIndex];
    const ethereumRPCUrl = ethereumRPC[rpcIndex];

    if (!maticRPCUrl || !ethereumRPCUrl) {
      continue;
    }

    try {
      // initialize matic client
      const rootChain = await initMatic(
        isMainnet,
        version,
        maticRPCUrl,
        ethereumRPCUrl,
      ).then((maticClient: any) => {
        return maticClient.exitUtil.rootChain;
      });

      // check last child block included
      const lastChildBlock = await rootChain.getLastChildBlock();
      if (parseInt(lastChildBlock) >= parseInt(blockNumber)) {
        // fetch header block information
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
          message: 'success',
        };
      } else {
        throw new InfoError(errorTypes.BlockNotIncluded, 'No block found');
      }

      break;
    } catch (error: any) {
      if (error.type === errorTypes.BlockNotIncluded || i === maxRetries - 1) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return result;
}

/**
 * fastMerkleProof
 *
 * @param {String} start
 * @param {String} end
 * @param {String} number
 * @param {Boolean} isMainnet
 * @param {String} version
 * @returns {Object}
 */
export async function fastMerkleProof(
  start: string,
  end: string,
  number: number,
  isMainnet: boolean,
  version: string,
) {
  const { ethereumRPC, maticRPC, maxRetries, rpcLength } =
    getVersionDetails(version);
  const initialRpcIndex = isMainnet
    ? config.mainnetRpcIndex
    : config.testnetRpcIndex;

  let proof;

  // loop over rpcs to retry in case of an rpc error
  for (let i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength;
    const maticRPCUrl = maticRPC[rpcIndex];
    const ethereumRPCUrl = ethereumRPC[rpcIndex];

    if (!maticRPCUrl || !ethereumRPCUrl) {
      continue;
    }

    try {
      // initialize matic client
      const maticClient = await initMatic(
        isMainnet,
        version,
        maticRPCUrl,
        ethereumRPCUrl,
      );

      // get merkle proof
      proof = await maticClient.exitUtil.getBlockProof(number, { start, end });

      break;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return { proof };
}

/**
 * generateExitPayload
 *
 * @param {String} blockNumber
 * @param {String} eventSignature
 * @param {Boolean} isMainnet
 * @param {String} version
 * @returns {Object}
 */
export async function generateExitPayload(
  burnTxHash: string,
  eventSignature: string,
  tokenIndex: number,
  isMainnet: boolean,
  version: string,
) {
  const { ethereumRPC, maticRPC, maxRetries, rpcLength } =
    getVersionDetails(version);
  const initialRpcIndex = isMainnet
    ? config.mainnetRpcIndex
    : config.testnetRpcIndex;

  let result;
  let isCheckpointed;

  logger.info({
    location: 'v1ProofGenerationServices.generateExitPayload',
    data: `max retries ${maxRetries}`,
  });

  // loop over rpcs to retry in case of an in case of an rpc error
  for (let i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength;
    const maticRPCUrl = maticRPC[rpcIndex];
    const ethereumRPCUrl = ethereumRPC[rpcIndex];

    if (!maticRPCUrl || !ethereumRPCUrl) {
      continue;
    }

    logger.info({
      location: 'v1ProofGenerationServices.generateExitPayload',
      data: `rpcIndex ${rpcIndex}`,
    });
    try {
      // initialize matic client
      const maticClient = await initMatic(
        isMainnet,
        version,
        maticRPCUrl,
        ethereumRPCUrl,
      );

      // check for checkpoint
      if (!isCheckpointed) {
        try {
          logger.info({
            location: 'v1ProofGenerationServices.generateExitPayload',
            call: 'Checking for checkpoint status',
            burnTxHash,
          });
          isCheckpointed =
            await maticClient.exitUtil.isCheckPointed(burnTxHash);
        } catch (error) {
          logger.info({
            location: 'v1ProofGenerationServices.generateExitPayload',
            call: 'Checking for checkpoint status failed',
            error,
          });
          if (i === maxRetries - 1) {
            throw new InfoError(
              errorTypes.IncorrectTx,
              'Incorrect burn transaction',
            );
          }
          throw new Error('Null receipt received');
        }
        if (!isCheckpointed) {
          throw new InfoError(
            errorTypes.TxNotCheckpointed,
            'Burn transaction has not been checkpointed yet',
          );
        }
      }
      logger.info({
        location: 'v1ProofGenerationServices.generateExitPayload',
        call: 'checkpoint status',
        isCheckpointed,
      });

      // build payload for exit
      try {
        result = await maticClient.exitUtil.buildPayloadForExit(
          burnTxHash,
          eventSignature,
          false,
          tokenIndex,
        );
      } catch (error: any) {
        logger.info({
          location: 'v1ProofGenerationServices.generateExitPayload',
          call: 'catch error',
          error,
        });
        if (
          error.message ===
          'Index is greater than the number of tokens in this transaction'
        ) {
          throw new InfoError(errorTypes.BlockNotIncluded, error.message);
        }
        if (i === maxRetries - 1) {
          throw new InfoError(
            errorTypes.BlockNotIncluded,
            'Event Signature log not found in tx receipt',
          );
        }
        throw new Error('Null receipt received');
      }

      if (!result) {
        throw new Error('Null result received');
      }

      break;
    } catch (error: any) {
      if (
        error.type === errorTypes.TxNotCheckpointed ||
        error.type === errorTypes.IncorrectTx ||
        error.type === errorTypes.BlockNotIncluded ||
        i === maxRetries - 1
      ) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return { message: 'Payload generation success', result };
}

/**
 * generateAllExitPayloads
 *
 * @param {String} blockNumber
 * @param {String} eventSignature
 * @param {Boolean} isMainnet
 * @param {String} version
 * @returns {Object}
 */
export async function generateAllExitPayloads(
  burnTxHash: string,
  eventSignature: string,
  isMainnet: boolean,
  version: string,
) {
  const { ethereumRPC, maticRPC, maxRetries, rpcLength } =
    getVersionDetails(version);
  const initialRpcIndex = isMainnet
    ? config.mainnetRpcIndex
    : config.testnetRpcIndex;

  let result;
  let isCheckpointed;

  logger.info(`max retries ${maxRetries}, ${ethereumRPC}`);

  // loop over rpcs to retry in case of an in case of an rpc error
  for (let i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength;
    const maticRPCUrl = maticRPC[rpcIndex];
    const ethereumRPCUrl = ethereumRPC[rpcIndex];

    if (!maticRPCUrl || !ethereumRPCUrl) {
      continue;
    }

    try {
      // initialize matic client
      const maticClient = await initMatic(
        isMainnet,
        version,
        maticRPCUrl,
        ethereumRPCUrl,
      );

      // check for checkpoint
      try {
        const safeBurnTxHash = burnTxHash.replace(/[\r\n]/g, '');
        logger.info(`Checking for checkpoint status ${safeBurnTxHash}`);
        isCheckpointed = await maticClient.exitUtil.isCheckPointed(burnTxHash);
        logger.info({ isCheckpointed: isCheckpointed });
      } catch (error) {
        logger.info({ error });
        if (i === maxRetries - 1) {
          throw new InfoError(
            errorTypes.IncorrectTx,
            'Incorrect burn transaction',
          );
        }
        throw new Error('Null receipt received');
      }
      if (!isCheckpointed) {
        throw new InfoError(
          errorTypes.TxNotCheckpointed,
          'Burn transaction has not been checkpointed yet',
        );
      }

      // build payload for exit
      try {
        result = await maticClient.exitUtil.buildMultiplePayloadsForExit(
          burnTxHash,
          eventSignature,
          false,
        );
        // FIXME: error is not logged?!
      } catch {
        if (i === maxRetries - 1) {
          throw new InfoError(
            errorTypes.BlockNotIncluded,
            'Event Signature log not found in tx receipt',
          );
        }
        throw new Error('Null receipt received');
      }

      if (!result) {
        throw new Error('Null result received');
      }

      break;
    } catch (error: any) {
      logger.error({ error });
      if (
        error.type === errorTypes.TxNotCheckpointed ||
        error.type === errorTypes.IncorrectTx ||
        error.type === errorTypes.BlockNotIncluded ||
        i === maxRetries - 1
      ) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return { message: 'Payload generation success', result };
}
