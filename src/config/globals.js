// global variables defined in config.yml

import configYaml from 'config-yaml'
import path from 'path'

// load config env
const root = path.normalize(`${__dirname}/../..`)

const fileName = '/config.yml'

const configFile = `${root}${fileName}`

const config = configYaml(configFile)

const debug = config.debug !== 'production'
export default {
  app: {
    name: config.app.name || 'Proof Generation API',
    port: parseInt(config.app.port || 5000, 10),
    maticRPC: config.app.maticRPCs,
    ethereumRPC: config.app.ethereumRPCs,
    goerliRPC: config.app.goerliRPC,
    mumbaiRPC: config.app.mumbaiRPC
  },
  debug: debug,
  networks: config.networks,
  mainnetRpcIndex: 0,
  testnetRpcIndex: 0,
  datadogApiKey: config.app.datadogApiKey
}
