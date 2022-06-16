import express from 'express'
import { validateParams } from '../middleware'
import { v1Controller } from '../controllers'

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
  '/block-included/:blockNumber',
  validateParams.validateBlockIncludedParams,
  v1Controller.isBlockIncluded
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
  '/fast-merkle-proof',
  validateParams.validateFastMerkleProofParams,
  v1Controller.fastMerkleProof
)

/**
 * @swagger
 * /{network}/exit-payload/{burnTxHash} :
 *  get:
 *    summary : Returns the payload to complete the exit/proof submission.
 *    description: Returns the input payload that has to be passed to the exit() function on the RootChainManager contract on the Ethereum Mainnet.
 *    tags:
 *     - v1
 *    parameters:
 *     - name: network
 *       in: path
 *       description: Enter network. Must either be 'matic' for mainnet or 'mumbai' for testnet
 *       required: true
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
router.get(
  '/exit-payload/:burnTxHash',
  validateParams.validateExitPayloadParams,
  v1Controller.exitPayload
)

/**
 * @swagger
 * /{network}/all-exit-payload/{burnTxHash} :
 *  get:
 *    summary : Returns the payload to complete the exit/proof submission.
 *    description: Returns the input payload that has to be passed to the exit() function on the RootChainManager contract on the Ethereum Mainnet.
 *    tags:
 *     - v1
 *    parameters:
 *     - name: network
 *       in: path
 *       description: Enter network. Must either be 'matic' for mainnet or 'mumbai' for testnet
 *       required: true
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
router.get(
  '/all-exit-payloads/:burnTxHash',
  validateParams.validateExitPayloadParams,
  v1Controller.allExitPayloads
)

export default router
