import { getEnv } from './env.ts';

// Getter properties defer env access to first use, so importing this module
// does not trigger env validation when running tests against TEST_BASE_URL.
const config = {
  get app() {
    const env = getEnv();
    return {
      name: env.NAME,
      port: env.PORT,
      ethereumRPC: env.ETHEREUM_RPC,
      sepoliaRPC: env.SEPOLIA_RPC,
      maticRPC: env.MATIC_RPC,
      amoyRPC: env.AMOY_RPC,
      zkEVMMainnetURL: env.ZKEVM_MAINNET_URL,
      zkEVMTestnetURL: env.ZKEVM_TESTNET_URL,
      xERPCSecretToken: env.ERPC_SECRET_TOKEN
    };
  },
  get debug() {
    return getEnv().NODE_ENV !== 'production';
  },
  mainnetRpcIndex: 0,
  testnetRpcIndex: 0
};

export { config };
