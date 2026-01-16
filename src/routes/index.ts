import { Hono } from 'hono';

import v1Route from './v1';
import zkEVMRoute from './zkEVM';

const router = new Hono();

router.route('/v1/:network', v1Route);
router.route('/zkevm/:network', zkEVMRoute);

export default router;
