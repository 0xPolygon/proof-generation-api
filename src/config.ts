import { env } from './env.ts';

const config = {
  app: {
    name: env.NAME,
    port: env.PORT,
    ethereumRPC: env.ETHEREUM_RPC,
    sepoliaRPC: env.SEPOLIA_RPC,
    maticRPC: env.MATIC_RPC,
    amoyRPC: env.AMOY_RPC,
    zkEVMMainnetURL: env.ZKEVM_MAINNET_URL,
    zkEVMTestnetURL: env.ZKEVM_TESTNET_URL,
    xERPCSecretToken: env.ERPC_SECRET_TOKEN,
  },
  debug: env.NODE_ENV !== 'production',
  mainnetRpcIndex: 0,
  testnetRpcIndex: 0,
};

export default config;
