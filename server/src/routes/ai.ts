import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as ctrl from '../controllers/ai';

const router = Router();

router.use(requireAuth);

router.post('/parse', ctrl.parseSubmission);
router.post('/review', ctrl.reviewFile);

export default router;
