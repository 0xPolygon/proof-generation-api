import config from '../config/globals'
import errorTypes from '../config/errorTypes'
import { initMatic, convert } from '../helpers/maticClient'
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

  var result

  // loop over rpcs to retry in case of an rpc error
  for (var i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength
    try {
      // initialize matic client
      const rootChain = await initMatic(isMainnet, maticRPC[rpcIndex], ethereumRPC[rpcIndex]).then((maticClient) => {
        return maticClient.exitUtil.rootChain
      })

      // check last child block included
      const lastChildBlock = await rootChain.getLastChildBlock()
      if (parseInt(lastChildBlock) >= parseInt(blockNumber)) {
        // fetch header block information
        const headerBlockNumber = await rootChain.findRootBlockFromChild(blockNumber).then((result) => {
          return convert(result)
        })

        const headerBlock = await rootChain.method(
          'headerBlocks',
          headerBlockNumber
        ).then(method => {
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

      // if rpc has been changed, update the global current rpc index
      if (rpcIndex !== initialRpcIndex) {
        isMainnet
          ? config.mainnetRpcIndex = rpcIndex
          : config.testnetRpcIndex = rpcIndex
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
  const initialRpcIndex = isMainnet ? config.mainnetRpcIndex : config.testnetRpcIndex

  var proof

  // loop over rpcs to retry in case of an rpc error
  for (var i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength
    try {
      // initialize matic client
      const maticClient = await initMatic(isMainnet, maticRPC[rpcIndex], ethereumRPC[rpcIndex])

      // get merkle proof
      proof = await maticClient.exitUtil.getBlockProof(number, { start, end })

      // if rpc has been changed, update the global current rpc index
      if (rpcIndex !== initialRpcIndex) {
        isMainnet
          ? config.mainnetRpcIndex = rpcIndex
          : config.testnetRpcIndex = rpcIndex
      }
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
export async function generateExitPayload(burnTxHash, eventSignature, isMainnet) {
  const maticRPC = isMainnet ? config.app.maticRPC : config.app.mumbaiRPC
  const ethereumRPC = isMainnet ? config.app.ethereumRPC : config.app.goerliRPC
  const maxRetries = isMainnet ? mainnetMaxRetries : testnetMaxRetries
  const rpcLength = isMainnet ? mainnetRPCLength : testnetRPCLength
  const initialRpcIndex = isMainnet ? config.mainnetRpcIndex : config.testnetRpcIndex

  var result

  // loop over rpcs to retry in case of an in case of an rpc error
  for (var i = 0; i < maxRetries; i++) {
    const rpcIndex = (initialRpcIndex + i) % rpcLength
    try {
      // initialize matic client
      const maticClient = await initMatic(isMainnet, maticRPC[rpcIndex], ethereumRPC[rpcIndex])

      // fetch last child block included
      const lastChildBlock = await maticClient.exitUtil.rootChain.getLastChildBlock()

      // fetch transaction receipt
      try {
        const receipt = await maticClient.client.child.getTransactionReceipt(burnTxHash)
        if (parseInt(lastChildBlock) < parseInt(receipt.blockNumber)) {
          throw new InfoError(errorTypes.TxNotCheckpointed, 'Burn transaction has not been checkpointed yet')
        }
      } catch (error) {
        // temporary fix for when we receive null receipts
        // should be reverted back when issue is fixed

        if (i === maxRetries - 1) {
          throw new InfoError(errorTypes.IncorrectTx, 'Incorrect burn transaction')
        }
        throw new Error('Null receipt received')
      }

      // build payload for exit
      try {
        result = await maticClient.exitUtil.buildPayloadForExit(burnTxHash, eventSignature)
      } catch {
        throw new InfoError(errorTypes.BlockNotIncluded, 'Event Signature log not found in tx receipt')
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
        error.type === errorTypes.BlockNotIncluded ||
        i === maxRetries - 1) {
        throw error
      }
    }
  }
  return { message: 'Payload generation success', result }
}
