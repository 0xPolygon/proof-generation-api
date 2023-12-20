import { config } from 'dotenv'

config()

const debug = process.env.NODE_ENV !== 'production'
export default {
  app: {
    name: process.env.NAME || 'Proof Generation API',
    port: parseInt(process.env.PORT || 5000, 10),
    ethereumRPC: JSON.parse(process.env.ETHEREUM_RPC),
    goerliRPC: JSON.parse(process.env.GOERLI_RPC),
    sepoliaRPC: JSON.parse(process.env.SEPOLIA_RPC),
    maticRPC: JSON.parse(process.env.MATIC_RPC),
    mumbaiRPC: JSON.parse(process.env.MUMBAI_RPC),
    amoyRPC: JSON.parse(process.env.AMOY_RPC),
    zkEVMMainnetURL: process.env.ZKEVM_MAINNET_URL,
    zkEVMTestnetURL: process.env.ZKEVM_TESTNET_URL,
    zkEVMNewTestnetURL: process.env.ZKEVM_NEW_TESTNET_URL
  },
  debug: debug,
  mainnetRpcIndex: 0,
  testnetRpcIndex: 0,
  sentry: {
    dsn: process.env.SENTRY_DSN
  }
}
