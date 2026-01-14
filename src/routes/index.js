import express from 'express';
import { v1Routes } from './v1.js';
import { zkEVMRoutes } from './zkEVM.js';
import { registerMiddleware } from '../middleware/index.js';

const router = express.Router({
  mergeParams: true,
});

registerMiddleware(router);

router.use('/v1/:network', v1Routes);
router.use('/zkevm/:network', zkEVMRoutes);

export const indexRoutes = router;
