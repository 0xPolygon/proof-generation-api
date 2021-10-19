import logger from '../config/logger'
import config from '../config/globals'
import errorTypes from '../config/errorTypes'
import initMatic from '../helpers/maticClient'
import { InfoError } from '../helpers/errorHelper'

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
  const initialRpcIndex = isMainnet ? config.mainnetRpcIndex : config.testnetRpcIndex

  var matic
  var result

  // loop over rpcs to retry in case of an rpc error
  for (var i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength
    try {
      // initialize matic client
      await initMatic(isMainnet, maticRPC[rpcIndex], ethereumRPC[rpcIndex]).then((obj) => {
        matic = obj.matic
      })

      // check last child block included
      const lastChildBlock = await matic.rootChain.getLastChildBlock()
      if (parseInt(lastChildBlock) >= parseInt(blockNumber)) {
        // fetch header block information
        let headerBlockNumber = await matic.rootChain.findHeaderBlockNumber(
          blockNumber
        )
        headerBlockNumber = matic.encode(headerBlockNumber)
        const headerBlock = await matic.web3Client.call(
          matic.rootChain.rootChain.methods.headerBlocks(headerBlockNumber)
        )

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

      // if rpc has been changed, update the global current rpc index
      if (rpcIndex !== initialRpcIndex) {
        isMainnet
          ? config.mainnetRpcIndex = rpcIndex
          : config.testnetRpcIndex = rpcIndex
      }
      break
    } catch (error) {
      if (error.type === errorTypes.BlockNotIncluded) {
        throw error
      }
      logger.error(`error in isBlockIncluded function\nrpcIndex = ${rpcIndex}\n`, error)
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
  const initialRpcIndex = isMainnet ? config.mainnetRpcIndex : config.testnetRpcIndex

  var maticPoS
  var proof

  // loop over rpcs to retry in case of an rpc error
  for (var i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength
    try {
      // initialize matic client
      await initMatic(isMainnet, maticRPC[rpcIndex], ethereumRPC[rpcIndex]).then((obj) => {
        maticPoS = obj.maticPoS
      })

      // get merkle proof
      proof = await maticPoS.posRootChainManager.exitFastMerkle(
        start,
        end,
        number
      )

      // if rpc has been changed, update the global current rpc index
      if (rpcIndex !== initialRpcIndex) {
        isMainnet
          ? config.mainnetRpcIndex = rpcIndex
          : config.testnetRpcIndex = rpcIndex
      }
      break
    } catch (error) {
      logger.error(`error in fastMerkleProof function\nrpcIndex = ${rpcIndex}\n`, error)
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
export async function generateExitPayload(burnTxHash, eventSignature, isMainnet) {
  const maticRPC = isMainnet ? config.app.maticRPC : config.app.mumbaiRPC
  const ethereumRPC = isMainnet ? config.app.ethereumRPC : config.app.goerliRPC
  const maxRetries = isMainnet ? mainnetMaxRetries : testnetMaxRetries
  const rpcLength = isMainnet ? mainnetRPCLength : testnetRPCLength
  const initialRpcIndex = isMainnet ? config.mainnetRpcIndex : config.testnetRpcIndex

  var matic
  var maticPoS
  var result

  // loop over rpcs to retry in case of an in case of an rpc error
  for (var i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength
    try {
      // initialize matic client
      await initMatic(isMainnet, maticRPC[rpcIndex], ethereumRPC[rpcIndex]).then((obj) => {
        matic = obj.matic
        maticPoS = obj.maticPoS
      })

      // fetch last child block included
      const lastChildBlock = await matic.rootChain.getLastChildBlock()

      // fetch transaction receipt
      const receipt = await matic.web3Client.getMaticWeb3().eth.getTransactionReceipt(burnTxHash)

      if (!receipt || !receipt.blockNumber) {
      // temporary fix for when we receive null receipts
      // should be reverted back when issue is fixed

        if (i === maxRetries - 1) {
          throw new InfoError(errorTypes.IncorrectTx, 'Incorrect burn transaction')
        }
        throw new Error('Null receipt received')
      }
      if (parseInt(lastChildBlock) < parseInt(receipt.blockNumber)) {
        throw new InfoError(errorTypes.TxNotCheckpointed, 'Burn transaction has not been checkpointed yet')
      }

      // build payload for exit
      result = await maticPoS.posRootChainManager.exitManager.buildPayloadForExit(
        burnTxHash,
        eventSignature
      )
      if (!result) {
        throw new InfoError(errorTypes.BlockNotIncluded, 'No block found')
      }

      // if rpc has been changed, update the global current rpc index
      if (rpcIndex !== initialRpcIndex) {
        isMainnet
          ? config.mainnetRpcIndex = rpcIndex
          : config.testnetRpcIndex = rpcIndex
      }
      break
    } catch (error) {
      if (error.type === errorTypes.TxNotCheckpointed ||
        error.type === errorTypes.IncorrectTx ||
        error.type === errorTypes.BlockNotIncluded) {
        throw error
      }
      logger.error(`error in generateExitPayload function\nrpcIndex = ${rpcIndex}\n`, error)
    }
  }
  return { message: 'Payload generation success', result }
}
