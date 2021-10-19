// validate parameters received

import { handleBadRequest, handleError } from '../helpers/responseHandlers'
import logger from '../config/logger'

export default {
  /**
   * Validate params
   *
   * @param {Request} req
   * @param {Response} res
   * @param {NextFunctin} next
   * @returns {void}
  */

  // block-included params validation
  validateBlockIncludedParams: (req, res, next) => {
    const blockNumber = req.params.blockNumber
    try {
      // block number must be an integer
      if (!isInteger(blockNumber)) {
        return handleBadRequest({ res, errMsg: 'Invalid block number!' })
      }
      next()
    } catch (error) {
      logger.error('error in validateBlockIncluded Params', error)
      handleError({ res, errMsg: 'Something went wrong while validating params' })
    }
  },

  // fast-merkle-proof params validation
  validateFastMerkleProofParams: (req, res, next) => {
    let start = req.query.start
    let end = req.query.end
    let number = req.query.number

    try {
      // params must be integers
      const invalidArgs = !isInteger(start) || !isInteger(end) | !isInteger(number)

      start = parseInt(start, 10)
      end = parseInt(end, 10)
      number = parseInt(number, 10)

      // start must be less than or equal to number
      // end must be greater than or equal to start
      if (invalidArgs || end < start || number > end || number < start) {
        return handleBadRequest({ res, errMsg: 'Invalid start or end or block numbers!' })
      }
      next()
    } catch (error) {
      logger.error('error in validateFastMerkleProof Params', error)
      handleError({ res, errMsg: 'Something went wrong while validating params' })
    }
  },

  // exit-payload params validation
  validateExitPayloadParams: (req, res, next) => {
    const burnTxHash = req.params.burnTxHash
    const eventSignature = req.query.eventSignature

    try {
      // burn tx hash and event signature are required
      if (!burnTxHash || !eventSignature) {
        return handleBadRequest({ res, errMsg: 'Burn tx or Event Signature missing!' })
      }

      // burn tx hash and event signature starts with 0x and their lengths must be equal to 66
      if (!burnTxHash.startsWith('0x') || !eventSignature.startsWith('0x') || burnTxHash.length !== 66 || eventSignature.length !== 66) {
        return handleBadRequest({ res, errMsg: 'Incorrect Burn tx or Event Signature!' })
      }
      next()
    } catch (error) {
      logger.error('error in validateExitPayload Params', error)
      handleError({ res, errMsg: 'Something went wrong while validating params' })
    }
  }
}

function isInteger(str) {
  str = str.trim()
  if (!str) {
    return false
  }
  str = str.replace(/^0+/, '') || '0'
  var n = Math.floor(Number(str))
  return n !== Infinity && String(n) === str && n >= 0
}
