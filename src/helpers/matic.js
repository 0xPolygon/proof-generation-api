import Matic, { MaticPOSClient } from '@maticnetwork/maticjs'

// get matic and maticPoS clients
async function initMatic(isMainnet, maticRPC, ethereumRPC) {
  const _network = isMainnet ? 'mainnet' : 'testnet'
  const _version = isMainnet ? 'v1' : 'mumbai'

  const maticConfig = {
    network: _network,
    version: _version,
    parentProvider: ethereumRPC,
    maticProvider: maticRPC,
    parentDefaultOptions: {},
    maticDefaultOptions: {}
  }
  const maticObj = new Matic(maticConfig)
  const maticPoSObj = new MaticPOSClient(maticConfig)
  await maticObj.initialize()
  return { matic: maticObj, maticPoS: maticPoSObj }
}

export default initMatic
