import { providers } from 'ethers';

import { POSClient } from '@polygonlabs/maticjs';
import { ethersV5Adapter } from '@polygonlabs/maticjs/ethers-v5';

import { config } from './config.ts';

// Bounds parallel getTransactionReceipt calls maticjs fires per exit-payload build
// (the SDK's `proofConcurrency`); one large block must not exhaust the RPC and the process.
const RECEIPT_REQUEST_CONCURRENCY = 10;

// ethers v5 defaults to 120s per call, which lets a slow or overloaded provider hold a
// request (and its sockets) for minutes; fail the call fast and move to the next provider.
const RPC_TIMEOUT_MS = 10_000;

// The POSClient plus the two providers it was built on. The providers are exposed
// because some reads have no POSClient method: the receipt pre-check and the raw
// RootChain `headerBlocks` read both go straight to ethers.
export interface MaticClient {
  pos: POSClient;
  parentProvider: providers.StaticJsonRpcProvider;
  childProvider: providers.StaticJsonRpcProvider;
}

const createProvider = (url: string): providers.StaticJsonRpcProvider =>
  new providers.StaticJsonRpcProvider({
    url,
    timeout: RPC_TIMEOUT_MS,
    headers: {
      ...(config.app.xERPCSecretToken ? { 'X-ERPC-Secret-Token': config.app.xERPCSecretToken } : {})
    }
  });

// One initialised MaticClient per (network, version, maticRPC, ethereumRPC) tuple,
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
const clientCache = new Map<string, Promise<MaticClient>>();

export const initMatic = (
  isMainnet: boolean,
  version: string,
  maticRPC: string,
  ethereumRPC: string
): Promise<MaticClient> => {
  const cacheKey = `${isMainnet ? 'mainnet' : 'testnet'}:${version}:${maticRPC}:${ethereumRPC}`;

  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const parentProvider = createProvider(ethereumRPC);
  const childProvider = createProvider(maticRPC);

  const promise = POSClient.init({
    network: isMainnet ? 'mainnet' : 'amoy',
    parent: ethersV5Adapter({ provider: parentProvider }),
    child: ethersV5Adapter({ provider: childProvider }),
    rootChainDefaultBlock: 'latest',
    proofConcurrency: RECEIPT_REQUEST_CONCURRENCY
  })
    .then((pos): MaticClient => ({ pos, parentProvider, childProvider }))
    .catch((err: unknown) => {
      clientCache.delete(cacheKey);
      throw err;
    });

  clientCache.set(cacheKey, promise);
  return promise;
};
