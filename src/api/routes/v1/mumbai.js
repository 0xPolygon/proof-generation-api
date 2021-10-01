import express from 'express'
import config from '../../../config/globals'
import logger from '../../../config/logger'
import initMatic from '../../../helpers/matic'

const router = express.Router({
  mergeParams: true
})

let matic = null
let maticPoS = null

function _initMatic() {
  initMatic(false, config.app.mumbaiRPC, config.app.goerliRPC)
    .then((obj) => {
      matic = obj.matic
      maticPoS = obj.maticPoS
      logger.info('[+] Hermione client is ready for Mumbai')
    }).catch(e => {
      logger.error('Error while creating hermione client for Mumbai', e.toString())
    })
}

_initMatic()

/**
 * @swagger
 * /mumbai/fast-merkle-proof :
 *  get:
 *    tags:
 *     - Mumbai Testnet
 *    summary: Returns the fast merkle block proof.
 *    description: Returns the block proof by making use of an optimised logic that gets the block details with minimum possible RPC calls to the Mumbai Testnet. This block proof can be further used to create the final payload that has to be used to complete the exit/proof submission step on the Goerli Testnet.
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
 *       '500':
 *        description: Internal Server Error
 */
router.get('/fast-merkle-proof', async(req, res) => {
  try {
    const start = parseInt(req.query.start, 10)
    const end = parseInt(req.query.end, 10)
    const number = parseInt(req.query.number, 10)

    // create proof
    const proof = await maticPoS.posRootChainManager.exitFastMerkle(start, end, number)

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
 * /mumbai/block-included/{blockNumber} :
 *  get:
 *    summary: Check if a block is checkpointed.
 *    description: Checks if a block on Mumbai Testnet has been checkpointed to the Goerli Testnet by the validators. Also this endpoint returns details of the checkpoint in which the block has been included.
 *    tags:
 *     - Mumbai Testnet
 *    parameters:
 *     - name: blockNumber
 *       in: path
 *       description: Enter the block number
 *       required: true
 *    responses:
 *       '200':
 *        description: A successful response
 *       '404':
 *        description: No Block found
 *       '500':
 *        description: Internal Server Error
 */
router.get('/block-included/:blockNumber', async(req, res) => {
  const blockNumber = req.params.blockNumber
  let result
  try {
    const lastChildBlock = await matic.rootChain.getLastChildBlock()
    if (parseInt(lastChildBlock) >= parseInt(blockNumber)) {
      let headerBlockNumber = await matic.rootChain.findHeaderBlockNumber(
        blockNumber
      )
      headerBlockNumber = matic.encode(headerBlockNumber)
      const headerBlock = await matic.web3Client.call(
        matic.rootChain.rootChain.methods.headerBlocks(
          headerBlockNumber
        )
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
  } catch (e) {
    logger.error('Error in block included API', {
      error: e.toString()
    })
    return res.status(500).json({
      error: true,
      message: 'Something went wrong while fetching block'
    })
  }
  // send result
  res.status(200).json(result)
})

/**
 * @swagger
 * /mumbai/exit-payload/{burnTxHash} :
 *  get:
 *    summary : Returns the payload to complete the exit/proof submission.
 *    description: Returns the input payload that has to be passed to the exit() function on the RootChainManager contract on the Goerli Testnet.
 *    tags:
 *     - Mumbai Testnet
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
  try {
    if (!burnTxHash || !eventSignature) {
      return res.status(400).json({
        error: true,
        message: 'Burn tx or Event Signature missing !'
      })
    }

    if (!burnTxHash.startsWith('0x') || !eventSignature.startsWith('0x') || burnTxHash.length !== 66) {
      return res.status(400).json({
        error: true,
        message: 'Incorrect Burn tx or Event Signature !'
      })
    }

    const lastChildBlock = await matic.rootChain.getLastChildBlock()
    const receipt = await matic.web3Client.getMaticWeb3().eth.getTransactionReceipt(burnTxHash)

    if (!receipt || !receipt.blockNumber) {
      return res.status(400).json({
        error: true,
        message: 'Incorrect Burn tx Hash'
      })
    }

    if (parseInt(lastChildBlock) < parseInt(receipt.blockNumber)) {
      return res.status(404).json({
        error: true,
        message: 'Burn transaction has not been checkpointed as yet !'
      })
    }

    payload = await maticPoS.posRootChainManager.customPayload(burnTxHash, eventSignature)

    if (!payload) {
      return res.status(404).json({
        error: true,
        message: 'No Block found'
      })
    }
  } catch (e) {
    logger.error('Error in exit payload API', {
      error: e.toString()
    })
    return res.status(500).json({
      error: true,
      message: 'Something went wrong while fetching block'
    })
  }
  // send result
  res.status(200).json({ message: 'Payload generation success', result: payload })
})

module.exports = router
