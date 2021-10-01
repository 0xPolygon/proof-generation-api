import express from 'express'
import config from '../../../config/globals'
import logger from '../../../config/logger'
import initMatic from '../../../helpers/matic'
import { verifyMerkleProof, isInteger, sleep } from '../../components/utils'

const router = express.Router({
  mergeParams: true
})

let rpcIndex = -1
let changingRpc = false
let matic
let maticPoS
const maxRetries = 2 * config.app.maticRPC.length

// Initiate new Matic and MaticPoS clients.
async function _initMatic() {
  if (!changingRpc) {
    changingRpc = true
    rpcIndex = (rpcIndex + 1) % config.app.maticRPC.length
    return initMatic(true, config.app.maticRPC[rpcIndex], config.app.ethereumRPC[rpcIndex]).then((obj) => {
      logger.info(`[+] Hermione client is ready for Mainnet - connected to RPC ${rpcIndex}`)
      matic = obj.matic
      maticPoS = obj.maticPoS
    })
      .catch((e) => {
        logger.error(`Error while creating hermione client Mainnet, ${e.toString()}`)
      }).finally(() => {
        changingRpc = false
      })
  }
}
_initMatic()
/**
 * @swagger
 * /matic/fast-merkle-proof :
 *  get:
 *    summary: Returns the fast merkle block proof.
 *    description: Returns the block proof by making use of an optimised logic that gets the block details with minimum possible RPC calls to the Polygon Mainnet. This block proof can be further used to create the final payload that has to be used to complete the exit/proof submission step on the Ethereum mainnet.
 *    tags:
 *     - Polygon Mainnet
 *    parameters:
 *     - name: start
 *       in: query
 *       description: Enter the start block
 *       required: true
 *     - name: end
 *       in: query
 *       description: Enter the end block
 *       required: true
 *     - name: number
 *       in: query
 *       description: Enter the Block Number
 *       required: true
 *    responses:
 *       '200':
 *        description: A successful response
 *       '400':
 *        description: Invalid parameters
 *       '500':
 *        description: Internal Server Error
 */
router.get('/fast-merkle-proof', async(req, res) => {
  try {
    let start = req.query.start
    let end = req.query.end
    let number = req.query.number

    const invalidArgs = !isInteger(start) || !isInteger(end) | !isInteger(number)

    start = parseInt(start, 10)
    end = parseInt(end, 10)
    number = parseInt(number, 10)

    if (invalidArgs || end < start || number > end || number < start) {
      return res.status(400).json({
        error: true,
        message: 'Invalid start or end or block numbers !'
      })
    }

    // create proof
    const proof = await merkleProof(start, end, number)

    // send result
    return res.status(200).json({
      proof: proof
    })
  } catch (e) {
    logger.error(e.toString() || 'Error while fetching block headers')
    return res.status(500).json({
      error: true,
      message: 'Something went wrong while fetching block headers'
    })
  }
})

/**
 * @swagger
 * /matic/block-included/{blockNumber} :
 *  get:
 *    summary: Check if a block is checkpointed
 *    description: Checks if a block on Polygon Mainnet has been checkpointed to the Ethereum Mainnet by the validators. Also this endpoint returns details of the checkpoint in which the block has been included.
 *    tags:
 *     - Polygon Mainnet
 *    parameters:
 *     - name: blockNumber
 *       in: path
 *       description: Enter the block number
 *       required: true
 *    responses:
 *       '200':
 *        description: A successful response
 *       '404':
 *        description: Invalid parameters
 *       '404':
 *        description: No Block found
 *       '500':
 *        description: Internal Server Error
 */
router.get('/block-included/:blockNumber', async(req, res) => {
  const blockNumber = req.params.blockNumber
  if (!isInteger(blockNumber)) {
    return res.status(400).json({
      error: true,
      message: 'Invalid block number !'
    })
  }
  let result
  for (var i = 0; i < maxRetries; i++) {
    const currentRpc = rpcIndex
    if (!changingRpc) {
      try {
        const lastChildBlock = await matic.rootChain.getLastChildBlock()
        if (parseInt(lastChildBlock) >= parseInt(blockNumber)) {
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
        }
        if (result == null) {
          return res.status(404).json({
            error: true,
            message: 'No Block found'
          })
        }
        break
      } catch (e) {
        logger.error(e.message)
        logger.error(`Error in block included API \nRPC index on error: ${currentRpc},\n ${{
        error: e.message
      }}`)
        if (!changingRpc && currentRpc === rpcIndex) { await _initMatic() }
        if (i === (config.app.maticRPC.length - 1).toString()) {
          return res.status(500).json({
            error: true,
            message: 'Something went wrong while fetching block'
          })
        }
      }
    } else {
      await sleep().catch((error) => { logger.error(`error sleeping: ${error.message}`) })
    }
  }
  // send result
  res.status(200).json(result)
})

/**
 * @swagger
 * /matic/exit-payload/{burnTxHash} :
 *  get:
 *    summary : Returns the payload to complete the exit/proof submission.
 *    description: Returns the input payload that has to be passed to the exit() function on the RootChainManager contract on the Ethereum Mainnet.
 *    tags:
 *     - Polygon Mainnet
 *    parameters:
 *     - name: burnTxHash
 *       in: path
 *       description: Enter the burn TransactionHash
 *       required: true
 *     - name: eventSignature
 *       in: query
 *       description: Enter the event signature
 *       required: true
 *    responses:
 *       '200':
 *        description: A successful response
 *       '404':
 *        description: No Block found
 *       '400':
 *        description: Invalid parameters
 *       '500':
 *        description: Internal Server Error
 */
router.get('/exit-payload/:burnTxHash', async(req, res) => {
  const burnTxHash = req.params.burnTxHash
  const eventSignature = req.query.eventSignature
  let payload

  if (!burnTxHash || !eventSignature) {
    return res.status(400).json({
      error: true,
      message: 'Burn tx or Event Signature missing !'
    })
  }

  if (!burnTxHash.startsWith('0x') || !eventSignature.startsWith('0x') || burnTxHash.length !== 66 || eventSignature.length !== 66) {
    return res.status(400).json({
      error: true,
      message: 'Incorrect Burn tx or Event Signature !'
    })
  }

  for (var i = 0; i < maxRetries; i++) {
    const currentRpc = rpcIndex
    if (!changingRpc) {
      try {
        const lastChildBlock = await matic.rootChain.getLastChildBlock()
        const receipt = await matic.web3Client.getMaticWeb3().eth.getTransactionReceipt(burnTxHash)

        if (!receipt || !receipt.blockNumber) {
          return res.status(400).json({
            error: true,
            message: 'Incorrect Burn tx'
          })
        }

        if (parseInt(lastChildBlock) < parseInt(receipt.blockNumber)) {
          return res.status(404).json({
            error: true,
            message: 'Burn transaction has not been checkpointed as yet !'
          })
        }

        payload = await maticPoS.posRootChainManager.customPayload(
          burnTxHash,
          eventSignature
        )

        if (!payload) {
          return res.status(404).json({
            error: true,
            message: 'No Block found'
          })
        }
        break
      } catch (e) {
        logger.error(`Error in exit payload API \nRPC index on error: ${rpcIndex},\n ${{
        error: e.message
      }}`)
        if (!changingRpc && currentRpc === rpcIndex) {
          logger.info('calling init matic from exit payload')
          await _initMatic()
        }
        if (i === maxRetries - 1) {
          return res.status(500).json({
            error: true,
            message: 'Something went wrong while fetching block'
          })
        }
      }
    } else {
      await sleep().catch((error) => { logger.error(`error sleeping: ${error.message}`) })
    }
  }
  // send result
  res
    .status(200)
    .json({ message: 'Payload generation success', result: payload })
})

module.exports = router

//
// Utility methods
//

//
// Generate merkle proof
//
async function merkleProof(start, end, number) {
  async function _merkleProof() {
    for (var i = 0; i < maxRetries; i++) {
      const currentRpc = rpcIndex
      if (!changingRpc) {
        try {
          const proof = await maticPoS.posRootChainManager.exitFastMerkle(
            start,
            end,
            number
          )
          if (!verifyMerkleProof(number - start, proof) || proof === '0x') {
            throw new Error('Invalid merkle proof created')
          }
          return proof
        } catch (err) {
        // Do nothing
          logger.error(`Error while creating merkle proof \nRPC index on error: ${rpcIndex} due to ${err.message}\n
          ${JSON.stringify({
            start: start,
            end: end,
            number: number,
            error: err.toString()
          })}`
          )
          if (!changingRpc && currentRpc === rpcIndex) {
            logger.info('calling init matic from merkle proof')
            await _initMatic()
          }
          if (i === maxRetries - 1) {
            throw new Error('Error generating merkel proof')
          }
        }
      } else {
        await sleep().catch((error) => { logger.error(`error sleeping: ${error.message}`) })
      }
    }
  }

  return await _merkleProof()
}
