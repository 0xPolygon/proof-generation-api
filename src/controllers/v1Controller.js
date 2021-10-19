// controller for v1

import logger from '../config/logger'
import { handleError, handleResponse } from '../helpers/responseHandlers'
import { isBlockIncluded, fastMerkleProof, generateExitPayload } from '../services'
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
        handleError({ res })
      }
      logger.error('error in isBlockIncluded controller\n', error)
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
      }
      handleResponse({ res, data: responseObj })
    } catch (error) {
      if (error instanceof InfoError) {
        handleError({ res, statusCode: 404, err: error })
      } else {
        handleError({ res })
      }
      logger.error('error in fastMerkleProof controller\n', error)
    }
  },

  exitPayload: async(req, res) => {
    try {
      const isMainnet = req.params.network === 'matic'
      const burnTxHash = req.params.burnTxHash
      const eventSignature = req.query.eventSignature
      const responseObj = await generateExitPayload(burnTxHash, eventSignature, isMainnet)
      handleResponse({ res, data: responseObj })
    } catch (error) {
      if (error instanceof InfoError) {
        handleError({ res, statusCode: 404, err: error })
      } else {
        handleError({ res })
      }
      logger.error('error in exitPayload controller\n', error)
    }
  }
}
