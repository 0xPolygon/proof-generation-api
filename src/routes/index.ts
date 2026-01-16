import { Router } from 'express';

import { v1Routes } from './v1.ts';
import { zkEVMRoutes } from './zkEVM.ts';

const router = Router();

router.use('/v1', v1Routes);
router.use('/zkevm', zkEVMRoutes);

export { router as indexRoutes };
