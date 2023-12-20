// controller for zkEVM

import logger from '../config/logger'
import { handleError, handleResponse } from '../helpers/responseHandlers'
import { bridge, merkelProofGenerator } from '../services'
import { InfoError } from '../helpers/errorHelper'

export default {
  bridge: async(req, res) => {
    try {
      const networkID = req.query.net_id
      const depositCount = req.query.deposit_cnt
      const network = req.params.network
      const responseObj = await bridge(
        networkID,
        depositCount,
        network
      )
      console.log(responseObj)
      handleResponse({ res, data: responseObj })
    } catch (error) {
      if (error instanceof InfoError) {
        handleError({ res, statusCode: 404, err: error })
      } else {
        logger.error('error in bridge controller\n', error)
        handleError({ res })
      }
    }
  },

  merkelProofGenerator: async(req, res) => {
    try {
      const networkID = req.query.net_id
      const depositCount = req.query.deposit_cnt
      const network = req.params.network
      const responseObj = await merkelProofGenerator(
        networkID,
        depositCount,
        network
      )
      handleResponse({ res, data: responseObj })
    } catch (error) {
      if (error instanceof InfoError) {
        handleError({ res, statusCode: 404, err: error })
      } else {
        logger.error(
          'error in merkelProofGenerator controller\n',
          error
        )
        handleError({ res })
      }
    }
  }
}
