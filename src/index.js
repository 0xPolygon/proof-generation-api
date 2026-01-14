import { startServer } from './express.js';
import * as config from './config/globals.js';

const port = config.app.port;

startServer(port);
