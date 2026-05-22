import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as ctrl from '../controllers/intake';

const router = Router();
router.use(requireAuth);

router.post('/zip', ctrl.uploadMiddleware.single('file'), ctrl.handleZipUpload);
router.post('/finmo', ctrl.uploadMiddleware.single('file'), ctrl.handleFinmoImport);
router.post('/submission-notes', ctrl.handleSubmissionNotes);

export default router;
