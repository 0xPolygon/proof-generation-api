import maticJs from '@maticnetwork/maticjs';
import maticjsWeb3 from '@maticnetwork/maticjs-web3';

const { Converter, POSClient, use } = maticJs;
const { Web3ClientPlugin } = maticjsWeb3;

// install web3 plugin
use(Web3ClientPlugin);

// get matic and maticPoS clients from maticjs
async function initMatic(isMainnet, version, maticRPC, ethereumRPC) {
  const _network = isMainnet ? 'mainnet' : 'testnet';

  const maticConfig = {
    network: _network,
    version: version,
    parent: {
      provider: ethereumRPC,
      defaultConfig: {},
    },
    child: {
      provider: maticRPC,
      defaultConfig: {},
    },
    rootChainDefaultBlock: 'latest',
  };
  const posClient = new POSClient();
  await posClient.init(maticConfig);
  return posClient;
}

async function convert(value) {
  return Converter.toHex(value);
}

export { initMatic, convert };
