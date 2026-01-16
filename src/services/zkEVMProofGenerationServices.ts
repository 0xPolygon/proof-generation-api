/* eslint-disable no-undef */
import config from '../config'
import { InfoError } from '../helpers/errorHelper'
import errorTypes from '../config/errorTypes'
import { Logger } from '@polygonlabs/servercore'

function getBridgeAPIUrl(network: string) {
  switch (network) {
    case 'mainnet':
    case 'cherry':
      return config.app.zkEVMMainnetURL
    case 'testnet':
    case 'cardona':
      return config.app.zkEVMTestnetURL
    default:
      return config.app.zkEVMMainnetURL
  }
}

/**
 *
 * @param {number} networkID
 * @param {number} depositCount
 * @param {string} network
 * @returns
 */
export async function bridge(networkID: number, depositCount: number, network: string) {
  const zkEVMURL = getBridgeAPIUrl(network)

  const response = await fetch(
    `${zkEVMURL}/bridge?net_id=${networkID}&deposit_cnt=${depositCount}`
  )
  const data: any = await response.json()

  if (response.status !== 200) {
    Logger.info(`Error hitting ${zkEVMURL} bridge with networkId ${networkID} and deposit count ${depositCount} - ${JSON.stringify(data)}`)
    throw new InfoError(errorTypes.ZKEVMError, data.message)
  }
  return data
}

/**
 *
 * @param {number} networkID
 * @param {number} depositCount
 * @param {string} network
 * @returns
 */
export async function merkelProofGenerator(networkID: number, depositCount: number, network: string) {
  const zkEVMURL = getBridgeAPIUrl(network)

  const response = await fetch(
    `${zkEVMURL}/merkle-proof?net_id=${networkID}&deposit_cnt=${depositCount}`
  )
  const data: any = await response.json()

  if (response.status !== 200) {
    Logger.info(`Error hitting ${zkEVMURL} merkle proof with networkId ${networkID} and deposit count ${depositCount} - ${JSON.stringify(data)}`)
    throw new InfoError(errorTypes.ZKEVMError, data.message)
  }
  return data
}
