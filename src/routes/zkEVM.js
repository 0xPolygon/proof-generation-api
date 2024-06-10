import express from 'express'
import { validateParams } from '../middleware'
import { zkEVMController } from '../controllers'

const router = express.Router({
  mergeParams: true
})

/**
 * @swagger
 * /{network}/block-included/{blockNumber} :
 *  get:
 *    summary: Check if a block is checkpointed.
 *    description: Checks if a block on Polygon Mainnet has been checkpointed to the Ethereum Mainnet by the validators. Also this endpoint returns details of the checkpoint in which the block has been included.
 *    tags:
 *     - v1
 *    parameters:
 *     - name: network
 *       in: path
 *       description: Enter network. Must either be 'matic' for mainnet or 'mumbai' for testnet
 *       required: true
 *     - name: blockNumber
 *       in: path
 *       description: Enter the block number
 *       required: true
 *    responses:
 *       '200':
 *        description: A successful response
 *       '400':
 *        description: Invalid parameters
 *       '404':
 *        description: No Block found
 *       '500':
 *        description: Internal Server Error
 */
router.get(
  '/bridge',
  validateParams.validateZkEVMParams,
  validateParams.validateZkEVMNetworkParam,
  zkEVMController.bridge
)

/**
 * @swagger
 * /{network}/fast-merkle-proof :
 *  get:
 *    summary: Returns the fast merkle block proof.
 *    description: Returns the block proof by making use of an optimised logic that gets the block details with minimum possible RPC calls to the Polygon Mainnet. This block proof can be further used to create the final payload that has to be used to complete the exit/proof submission step on the Ethereum mainnet.
 *    tags:
 *     - v1
 *    parameters:
 *     - name: network
 *       in: path
 *       description: Enter network. Must either be 'matic' for mainnet or 'mumbai' for testnet
 *       required: true
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
router.get(
  '/merkle-proof',
  validateParams.validateZkEVMParams,
  validateParams.validateZkEVMNetworkParam,
  zkEVMController.merkelProofGenerator
)

export default router
