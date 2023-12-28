import express from 'express'
import { validateParams } from '../middleware'
import { zkEVMController } from '../controllers'

const router = express.Router({
  mergeParams: true
})

/**
 * @swagger
 * /{network}/bridge/ :
 *  get:
 *    summary: Check the bridge details using deposit count and network
 *    tags:
 *     - zkEVM
 *    parameters:
 *     - name: network
 *       in: path
 *       description: Enter network. Must either be 'mainnet' or 'cherry' for mainnet, 'testnet' or 'blueberry' for blueberry testnet, 'cardona' for cardona testnet
 *       required: true
 *     - name: net_id
 *       in: query
 *       description: Enter the network ID
 *       required: true
 *     - name: deposit_cnt
 *       in: query
 *       description: Enter the Deposit count
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
 * /{network}/merkle-proof :
 *  get:
 *    summary: Returns the merkle proof.
 *    tags:
 *     - zkEVM
 *    parameters:
 *     - name: network
 *       in: path
 *       description: Enter network. Must either be 'mainnet' or 'cherry' for mainnet, 'testnet' or 'blueberry' for blueberry testnet, 'cardona' for cardona testnet
 *       required: true
 *     - name: net_id
 *       in: query
 *       description: Enter the network ID
 *       required: true
 *     - name: deposit_cnt
 *       in: query
 *       description: Enter the Deposit count
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
