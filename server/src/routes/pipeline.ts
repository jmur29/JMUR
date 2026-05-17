import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import * as ctrl from '../controllers/pipeline';

const router = Router({ mergeParams: true });

router.use(requireAuth);

// POST /api/applications/:id/process
router.post('/', requireRole(['ADMIN', 'UNDERWRITER']), ctrl.startProcessing);

// GET /api/applications/:id/process/status
router.get('/status', ctrl.getProcessingStatus);

export default router;
