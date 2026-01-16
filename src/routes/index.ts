import { Hono } from 'hono';

import { v1Routes } from './v1.ts';
import { zkEVMRoutes } from './zkEVM.ts';

const router = new Hono();

router.route('/v1/:network', v1Routes);
router.route('/zkevm/:network', zkEVMRoutes);

export { router as indexRoutes };
