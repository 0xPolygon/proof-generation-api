import express from 'express';
import cors from 'cors';
import listEndpoints from 'express-list-endpoints';

import * as config from './config/globals.js';
// import api from './api'
import { logger } from './config/logger.js';
import { indexRoutes } from './routes/index.js';

// SWAGGER
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// creating express server
const app = express();

app.use(cors());
app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  })
);

// defining swagger options
const swaggerOptions = {
  swaggerDefinition: {
    info: {
      version: '1.0.0',
      title: 'Proof generation API',
      description: `The Proof Generation API primarily helps the Matic SDK by executing a few heavy processes
       on a dedicated backend server. Proof generation and block inclusion check are some of the endpoints
       on this proof generation API. The logic behind these API's involves making several RPC calls to the Polygon
       chain in order to generate the proof or check block checkpoint inclusion.`,
    },
    basePath: '/api',
  },
  apis: ['./src/routes/v1.js', './src/routes/zkEVM.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// APIs
app.use('/api', indexRoutes);
app.get('/', async (req, res) => {
  const result = listEndpoints(app).map((c) => {
    return {
      path: c.path,
      methods: c.methods.join(','),
    };
  });
  res.json(result);
});

// healthcheck endpoint
app.get('/health-check', (req, res) => {
  return res.status(200).json({ success: true, message: 'Health Check Success' });
});

// Invalid endpoint error handling
app.use((req, res, next) => {
  const error = new Error('Not found');
  error.status = 404;
  next(error);
});

app.use((error, req, res, next) => {
  res.status(error.status || 500);
  res.json({
    error: {
      message: error.message,
    },
  });
});

// list endpoints
logger.info('-----------------------------------------');
listEndpoints(app).forEach((c) => {
  logger.info(`${c.methods.join(',')} -> ${c.path}`);
});
logger.info('-----------------------------------------');

const startServer = async (port) => {
  // Bubble errors calling `listen()` up to callers so they get an async stack trace
  await new Promise((resolve, reject) => {
    app.listen(port).once('listening', resolve).once('error', reject);
  });

  logger.info(`Proof Generation API server has started on port ${config.app.port}`);
};

// Export app definition for orchestration in integration tests, startApiServer() for bin deployment
export { app, startServer };
