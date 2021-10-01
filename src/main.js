import express from 'express'
import cors from 'cors'
import listEndpoints from 'express-list-endpoints'

import config from './config/globals'
import api from './api'
import logger from './config/logger'

// SWAGGER
const swaggerJsDoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')

// creating express server
const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({
  extended: false
}))

// defining swagger options
const swaggerOptions = {
  swaggerDefinition: {
    info: {
      version: '1.0.0',
      title: 'Network API',
      description: `The Network API primarily helps the Matic SDK by executing a few heavy processes
       on a dedicated backend server. Proof generation and block inclusion check are some of the endpoints
       on this network API. The logic behind these API's involves making several RPC calls to the Polygon
       chain in order to generate the proof or check block checkpoint inclusion`,
      contact: {
        name: 'Nitin Mittal'
      },
      servers: ['http://localhost:3000']
    },
    basePath: '/api/v1',
    host: 'apis.matic.network',
    schemes: [
      'https'
    ]
  },
  apis: ['./src/api/*.js']
}

const swaggerDocs = swaggerJsDoc(swaggerOptions)
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocs))

// APIs
app.use('/api', api)
app.get('/', async(req, res) => {
  const result = listEndpoints(app).map(c => {
    return {
      path: c.path,
      methods: c.methods.join(',')
    }
  })
  res.json(result)
})

// healthcheck endpoint
app.get('/health-check', (req, res) => {
  return res.status(200).json({ message: 'OK' })
})

// list endpoints
console.log('-----------------------------------------')
listEndpoints(app).forEach(c => {
  console.log(`${c.methods.join(',')} -> ${c.path}`)
})
console.log('-----------------------------------------')

// start app server
app.listen(config.app.port, function() {
  logger.info('Network API server has started', {
    port: config.app.port
  })
})
