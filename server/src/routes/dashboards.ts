import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as ctrl from '../controllers/dashboards';

const router = Router();

router.use(requireAuth);

// GET /api/dashboard/broker
router.get('/broker', ctrl.getBrokerDashboard);

// GET /api/dashboard/lender
router.get('/lender', ctrl.getLenderDashboard);

export default router;
