import { providers } from 'ethers';

import type { IPOSClientConfig } from '@maticnetwork/maticjs';

import maticJs from '@maticnetwork/maticjs';
import maticJs_Ethers from '@maticnetwork/maticjs-ethers';

import type { Logger } from './logger.ts';

import { config } from './config.ts';

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

const WARM_UP_TIMEOUT_MS = 5_000;

function withTimeout<T>({ ms, promise }: { ms: number; promise: Promise<T> }): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    );
  });
}

export async function warmMaticClients(logger: Logger): Promise<void> {
  // Mirrors src/routes/v1.ts's networkDetails map, at the RPC index requests
  // start from (config.mainnetRpcIndex / config.testnetRpcIndex).
  const warmUpTuples = [
    {
      ethereumRPC: config.app.ethereumRPC[config.mainnetRpcIndex],
      isMainnet: true,
      maticRPC: config.app.maticRPC[config.mainnetRpcIndex],
      version: 'v1'
    },
    {
      ethereumRPC: config.app.sepoliaRPC[config.testnetRpcIndex],
      isMainnet: false,
      maticRPC: config.app.amoyRPC[config.testnetRpcIndex],
      version: 'amoy'
    }
  ];

  const results = await Promise.allSettled(
    warmUpTuples.map(({ ethereumRPC, isMainnet, maticRPC, version }) => {
      if (!maticRPC || !ethereumRPC) {
        return Promise.reject(new Error(`no configured RPC endpoint for ${version}`));
      }
      return withTimeout({
        ms: WARM_UP_TIMEOUT_MS,
        promise: initMatic(isMainnet, version, maticRPC, ethereumRPC)
      });
    })
  );

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      logger.warn(
        { err: result.reason, version: warmUpTuples[i]?.version },
        'RPC provider warm-up failed; will retry at request time'
      );
    }
  });
}
