import config from '../config/globals'
import errorTypes from '../config/errorTypes'
import { initMatic, convert } from '../helpers/maticClient'
import { InfoError } from '../helpers/errorHelper'
import logger from '../config/logger'

const mainnetRPCLength = config.app.maticRPC.length // total mainnet rpcs
const mainnetMaxRetries = 2 * mainnetRPCLength // max mainnet retries
const testnetRPCLength = config.app.mumbaiRPC.length // total testnet rpcs
const testnetMaxRetries = 2 * testnetRPCLength // max testnet retries

/**
 * isBlockIncluded
 *
 * @param {String} blockNumber
 * @param {Boolean} isMainnet
 * @returns {Object}
 */
export async function isBlockIncluded(blockNumber, isMainnet) {
  const maticRPC = isMainnet ? config.app.maticRPC : config.app.mumbaiRPC
  const ethereumRPC = isMainnet ? config.app.ethereumRPC : config.app.goerliRPC
  const maxRetries = isMainnet ? mainnetMaxRetries : testnetMaxRetries
  const rpcLength = isMainnet ? mainnetRPCLength : testnetRPCLength
  const initialRpcIndex = isMainnet
    ? config.mainnetRpcIndex
    : config.testnetRpcIndex

  let result

  // loop over rpcs to retry in case of an rpc error
  for (let i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength
    try {
      // initialize matic client
      const rootChain = await initMatic(
        isMainnet,
        maticRPC[rpcIndex],
        ethereumRPC[rpcIndex]
      ).then((maticClient) => {
        return maticClient.exitUtil.rootChain
      })

      // check last child block included
      const lastChildBlock = await rootChain.getLastChildBlock()
      if (parseInt(lastChildBlock) >= parseInt(blockNumber)) {
        // fetch header block information
        const headerBlockNumber = await rootChain
          .findRootBlockFromChild(blockNumber)
          .then((result) => {
            return convert(result)
          })

        const headerBlock = await rootChain
          .method('headerBlocks', headerBlockNumber)
          .then((method) => {
            return method.read()
          })

        result = {
          headerBlockNumber,
          blockNumber,
          start: headerBlock.start,
          end: headerBlock.end,
          proposer: headerBlock.proposer,
          root: headerBlock.root,
          createdAt: headerBlock.createdAt,
          message: 'success'
        }
      } else {
        throw new InfoError(errorTypes.BlockNotIncluded, 'No block found')
      }

      break
    } catch (error) {
      if (error.type === errorTypes.BlockNotIncluded || i === maxRetries - 1) {
        throw error
      }
    }
  }
  return result
}

/**
 * fastMerkleProof
 *
 * @param {String} start
 * @param {String} end
 * @param {String} number
 * @param {Boolean} isMainnet
 * @returns {Object}
 */
export async function fastMerkleProof(start, end, number, isMainnet) {
  const maticRPC = isMainnet ? config.app.maticRPC : config.app.mumbaiRPC
  const ethereumRPC = isMainnet ? config.app.ethereumRPC : config.app.goerliRPC
  const maxRetries = isMainnet ? mainnetMaxRetries : testnetMaxRetries
  const rpcLength = isMainnet ? mainnetRPCLength : testnetRPCLength
  const initialRpcIndex = isMainnet
    ? config.mainnetRpcIndex
    : config.testnetRpcIndex

  let proof

  // loop over rpcs to retry in case of an rpc error
  for (let i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength
    try {
      // initialize matic client
      const maticClient = await initMatic(
        isMainnet,
        maticRPC[rpcIndex],
        ethereumRPC[rpcIndex]
      )

      // get merkle proof
      proof = await maticClient.exitUtil.getBlockProof(number, { start, end })

      break
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error
      }
    }
  }
  return { proof }
}

/**
 * generateExitPayload
 *
 * @param {String} blockNumber
 * @param {String} eventSignature
 * @param {Boolean} isMainnet
 * @returns {Object}
 */
export async function generateExitPayload(
  burnTxHash,
  eventSignature,
  tokenIndex,
  isMainnet
) {
  const maticRPC = isMainnet ? config.app.maticRPC : config.app.mumbaiRPC
  const ethereumRPC = isMainnet ? config.app.ethereumRPC : config.app.goerliRPC
  const maxRetries = isMainnet ? mainnetMaxRetries : testnetMaxRetries
  const rpcLength = isMainnet ? mainnetRPCLength : testnetRPCLength
  const initialRpcIndex = isMainnet
    ? config.mainnetRpcIndex
    : config.testnetRpcIndex

  let result
  let isCheckpointed

  logger.info(`max retries ${maxRetries}`)

  // loop over rpcs to retry in case of an in case of an rpc error
  for (let i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength
    logger.info(`rpcIndex ${rpcIndex}`)
    try {
      // initialize matic client
      const maticClient = await initMatic(
        isMainnet,
        maticRPC[rpcIndex],
        ethereumRPC[rpcIndex]
      )

      // check for checkpoint
      try {
        logger.info(`Checking for checkpoint status${burnTxHash}`)
        isCheckpointed = await maticClient.exitUtil.isCheckPointed(burnTxHash)
        logger.info(isCheckpointed)
      } catch (error) {
        logger.error(error)
        if (i === maxRetries - 1) {
          throw new InfoError(
            errorTypes.IncorrectTx,
            'Incorrect burn transaction'
          )
        }
        throw new Error('Null receipt received')
      }
      if (!isCheckpointed) {
        throw new InfoError(
          errorTypes.TxNotCheckpointed,
          'Burn transaction has not been checkpointed yet'
        )
      }

      // build payload for exit
      try {
        result = await maticClient.exitUtil.buildPayloadForExit(
          burnTxHash,
          eventSignature,
          false,
          tokenIndex
        )
      } catch (error) {
        logger.error(error)
        if (
          error.message ===
          'Index is grater than the number of tokens in this transaction'
        ) {
          throw new InfoError(errorTypes.BlockNotIncluded, error.message)
        }
        if (i === maxRetries - 1) {
          throw new InfoError(
            errorTypes.BlockNotIncluded,
            'Event Signature log not found in tx receipt'
          )
        }
        throw new Error('Null receipt received')
      }

      if (!result) {
        throw new Error('Null result received')
      }

      break
    } catch (error) {
      if (
        error.type === errorTypes.TxNotCheckpointed ||
        error.type === errorTypes.IncorrectTx ||
        error.type === errorTypes.BlockNotIncluded ||
        i === maxRetries - 1
      ) {
        throw error
      }
    }
  }
  return { message: 'Payload generation success', result }
}

/**
 * generateAllExitPayloads
 *
 * @param {String} blockNumber
 * @param {String} eventSignature
 * @param {Boolean} isMainnet
 * @returns {Object}
 */
export async function generateAllExitPayloads(
  burnTxHash,
  eventSignature,
  isMainnet
) {
  const maticRPC = isMainnet ? config.app.maticRPC : config.app.mumbaiRPC
  const ethereumRPC = isMainnet ? config.app.ethereumRPC : config.app.goerliRPC
  const maxRetries = isMainnet ? mainnetMaxRetries : testnetMaxRetries
  const rpcLength = isMainnet ? mainnetRPCLength : testnetRPCLength
  const initialRpcIndex = isMainnet
    ? config.mainnetRpcIndex
    : config.testnetRpcIndex

  let result
  let isCheckpointed

  logger.info(`max retries ${maxRetries}, ${ethereumRPC}`)

  // loop over rpcs to retry in case of an in case of an rpc error
  for (let i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength
    logger.info(`rpcIndex ${rpcIndex}`)
    try {
      // initialize matic client
      const maticClient = await initMatic(
        isMainnet,
        maticRPC[rpcIndex],
        ethereumRPC[rpcIndex]
      )

      // check for checkpoint
      try {
        logger.info(`Checking for checkpoint status${burnTxHash}`)
        isCheckpointed = await maticClient.exitUtil.isCheckPointed(burnTxHash)
        logger.info(isCheckpointed)
      } catch (error) {
        logger.error(error)
        if (i === maxRetries - 1) {
          throw new InfoError(
            errorTypes.IncorrectTx,
            'Incorrect burn transaction'
          )
        }
        throw new Error('Null receipt received')
      }
      if (!isCheckpointed) {
        throw new InfoError(
          errorTypes.TxNotCheckpointed,
          'Burn transaction has not been checkpointed yet'
        )
      }

      // build payload for exit
      try {
        result = await maticClient.exitUtil.buildMultiplePayloadsForExit(
          burnTxHash,
          eventSignature,
          false
        )
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new InfoError(
            errorTypes.BlockNotIncluded,
            'Event Signature log not found in tx receipt'
          )
        }
        throw new Error('Null receipt received')
      }

      if (!result) {
        throw new Error('Null result received')
      }

      break
    } catch (error) {
      logger.error(error)
      if (
        error.type === errorTypes.TxNotCheckpointed ||
        error.type === errorTypes.IncorrectTx ||
        error.type === errorTypes.BlockNotIncluded ||
        i === maxRetries - 1
      ) {
        throw error
      }
    }
  }
  return { message: 'Payload generation success', result }
}
