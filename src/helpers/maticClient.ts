import { providers } from 'ethers';

import type { IPOSClientConfig } from '@maticnetwork/maticjs';

import maticJs from '@maticnetwork/maticjs';
import maticJs_Ethers from '@maticnetwork/maticjs-ethers';

import { config } from '../config.ts';

const { Converter, POSClient, use } = maticJs; // default export :(

// eslint-disable-next-line import-x/no-named-as-default-member
const { Web3ClientPlugin } = maticJs_Ethers; // Default export shenanigans

// install web3 plugin
use(Web3ClientPlugin);

// get matic and maticPoS clients from maticjs
export const initMatic = async (
  isMainnet: boolean,
  version: string,
  maticRPC: string,
  ethereumRPC: string
) => {
  const _network = isMainnet ? 'mainnet' : 'testnet';

  const maticConfig: IPOSClientConfig = {
    network: _network,
    version: version,
    parent: {
      provider: new providers.JsonRpcProvider({
        url: ethereumRPC,
        headers: {
          ...(config.app.xERPCSecretToken
            ? { 'X-ERPC-Secret-Token': config.app.xERPCSecretToken }
            : {})
        }
      }),
      defaultConfig: {
        from: '0x54d03EC0C462e9a01F77579C090cdE0FC2617817'
      }
    },
    child: {
      provider: new providers.JsonRpcProvider({
        url: maticRPC,
        headers: {
          ...(config.app.xERPCSecretToken
            ? { 'X-ERPC-Secret-Token': config.app.xERPCSecretToken }
            : {})
        }
      }),
      defaultConfig: {
        from: '0x54d03EC0C462e9a01F77579C090cdE0FC2617817'
      }
    },
    rootChainDefaultBlock: 'latest'
  };
  const posClient = new POSClient();
  await posClient.init(maticConfig);
  return posClient;
};

export const convert = async (value: any) => {
  return Converter.toHex(value);
};
