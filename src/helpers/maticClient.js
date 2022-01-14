import { Converter, POSClient, use } from '@maticnetwork/maticjs'
import { Web3ClientPlugin } from '@maticnetwork/maticjs-web3'

// install web3 plugin
use(Web3ClientPlugin)

// get matic and maticPoS clients from maticjs
async function initMatic(isMainnet, maticRPC, ethereumRPC) {
  const _network = isMainnet ? 'mainnet' : 'testnet'
  const _version = isMainnet ? 'v1' : 'mumbai'

  const maticConfig = {
    network: _network,
    version: _version,
    parent: {
      provider: ethereumRPC,
      defaultConfig: {}
    },
    child: {
      provider: maticRPC,
      defaultConfig: {}
    }
  }
  const posClient = new POSClient()
  await posClient.init(maticConfig)
  return posClient
}

async function convert(value) {
  return Converter.toHex(value)
}

export { initMatic, convert }
