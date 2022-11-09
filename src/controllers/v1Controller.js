// controller for v1

import logger from '../config/logger'
import { handleError, handleResponse } from '../helpers/responseHandlers'
import {
  isBlockIncluded,
  fastMerkleProof,
  generateExitPayload,
  generateAllExitPayloads
} from '../services'
import { verifyMerkleProof } from '../middleware'
import { InfoError } from '../helpers/errorHelper'

export default {
  isBlockIncluded: async(req, res) => {
    try {
      const isMainnet = req.params.network === 'matic'
      const blockNumber = req.params.blockNumber
      const responseObj = await isBlockIncluded(blockNumber, isMainnet)
      handleResponse({ res, data: responseObj })
    } catch (error) {
      if (error instanceof InfoError) {
        handleError({ res, statusCode: 404, err: error })
      } else {
        logger.error('error in isBlockIncluded controller\n', error)
        handleError({ res })
      }
    }
  },

  fastMerkleProof: async(req, res) => {
    try {
      const isMainnet = req.params.network === 'matic'
      const start = req.query.start
      const end = req.query.end
      const number = req.query.number
      const responseObj = await fastMerkleProof(start, end, number, isMainnet)
      if (!verifyMerkleProof(number, start, responseObj.proof)) {
        handleError({ res, errMsg: 'Invalid merkle proof created' })
        return
      }
      handleResponse({ res, data: responseObj })
    } catch (error) {
      if (error instanceof InfoError) {
        handleError({ res, statusCode: 404, err: error })
      } else {
        logger.error('error in fastMerkleProof controller\n', error)
        handleError({ res })
      }
    }
  },

  exitPayload: async(req, res) => {
    try {
      const isMainnet = req.params.network === 'matic'
      const burnTxHash = req.params.burnTxHash
      const eventSignature = req.query.eventSignature
      const tokenIndex = req.query.tokenIndex || 0
      const responseObj = await generateExitPayload(
        burnTxHash,
        eventSignature,
        tokenIndex,
        isMainnet
      )
      handleResponse({ res, data: responseObj })
    } catch (error) {
      if (error instanceof InfoError) {
        handleError({ res, statusCode: 404, err: error })
      } else {
        logger.error('error in exitPayload controller\n', error)
        handleError({ res })
      }
    }
  },

  allExitPayloads: async(req, res) => {
    try {
      const isMainnet = req.params.network === 'matic'
      const burnTxHash = req.params.burnTxHash
      const eventSignature = req.query.eventSignature
      const responseObj = await generateAllExitPayloads(
        burnTxHash,
        eventSignature,
        isMainnet
      )
      handleResponse({ res, data: responseObj })
    } catch (error) {
      if (error instanceof InfoError) {
        handleError({ res, statusCode: 404, err: error })
      } else {
        logger.error('error in allExitPayloads controller\n', error)
        handleError({ res })
      }
    }
  }
}
