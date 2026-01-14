import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';

import { json } from 'express';

import * as config from '../config/globals.js';

/**
 * Init Express middleware
 *
 * @param {Router} router
 * @returns {void}
 */
export function registerMiddleware(router) {
  router.use(helmet());

  if (config.debug !== 'production') {
    router.use(cors({ origin: '*' }));
  } else {
    router.use(cors({ origin: [`http://localhost:${config.app.port}`] }));
  }

  router.use(json());
  router.use(compression());
}

export * as validateParams from './validateParams.js';
export { verifyMerkleProof } from './validateResults.js';
