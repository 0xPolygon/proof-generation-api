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

// One initialised POSClient per (network, version, maticRPC, ethereumRPC) tuple,
// shared for the lifetime of the process. Creating a new POSClient on every
// request was leaking provider instances causing the process to OOMKill under load.
//
// StaticJsonRpcProvider is used instead of JsonRpcProvider because this service
// only makes one-off RPC calls and never subscribes to events. JsonRpcProvider
// starts a 4-second polling timer when alive which accumulates block/filter state
// in long-lived cached instances. StaticJsonRpcProvider makes no background calls
// and holds no cached network state, making it safe to keep alive indefinitely.
//
// The cache stores Promises so that concurrent requests for the same key share
// a single in-flight initialisation rather than racing to create duplicates.
// A failed initialisation is evicted from the cache so the next request retries.
const clientCache = new Map<string, Promise<InstanceType<typeof POSClient>>>();

export const initMatic = (
  isMainnet: boolean,
  version: string,
  maticRPC: string,
  ethereumRPC: string
): Promise<InstanceType<typeof POSClient>> => {
  const cacheKey = `${isMainnet ? 'mainnet' : 'testnet'}:${version}:${maticRPC}:${ethereumRPC}`;

  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const _network = isMainnet ? 'mainnet' : 'testnet';

  const maticConfig: IPOSClientConfig = {
    network: _network,
    version: version,
    parent: {
      provider: new providers.StaticJsonRpcProvider({
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
      provider: new providers.StaticJsonRpcProvider({
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
  const promise = posClient
    .init(maticConfig)
    .then(() => posClient)
    .catch((err) => {
      clientCache.delete(cacheKey);
      throw err;
    });

  clientCache.set(cacheKey, promise);
  return promise;
};

export const convert = async (value: any) => {
  return Converter.toHex(value);
};
