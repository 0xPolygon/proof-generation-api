import type { IPOSClientConfig } from '@maticnetwork/maticjs';

import { Converter, POSClient, use } from '@maticnetwork/maticjs';
import { Web3ClientPlugin } from '@maticnetwork/maticjs-ethers';
import { providers } from 'ethers';

import { config } from '../config.ts';

// install web3 plugin
use(Web3ClientPlugin);

// get matic and maticPoS clients from maticjs
export const initMatic = async (
  isMainnet: boolean,
  version: string,
  maticRPC: string,
  ethereumRPC: string,
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
            : {}),
        },
      }),
      defaultConfig: {
        from: '0x54d03EC0C462e9a01F77579C090cdE0FC2617817',
      },
    },
    child: {
      provider: new providers.JsonRpcProvider({
        url: maticRPC,
        headers: {
          ...(config.app.xERPCSecretToken
            ? { 'X-ERPC-Secret-Token': config.app.xERPCSecretToken }
            : {}),
        },
      }),
      defaultConfig: {
        from: '0x54d03EC0C462e9a01F77579C090cdE0FC2617817',
      },
    },
    rootChainDefaultBlock: 'latest',
  };
  const posClient = new POSClient();
  await posClient.init(maticConfig);
  return posClient;
};

export const convert = async (value: any) => {
  return Converter.toHex(value);
};
