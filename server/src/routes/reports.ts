import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ApplicationIdParamSchema } from '../middleware/validate';
import * as ctrl from '../controllers/reports';

const router = Router();

router.use(requireAuth);

// GET /reports/:applicationId/html
router.get(
  '/:applicationId/html',
  validate(ApplicationIdParamSchema, 'params'),
  ctrl.htmlReport
);

// GET /reports/:applicationId/pdf
router.get(
  '/:applicationId/pdf',
  validate(ApplicationIdParamSchema, 'params'),
  ctrl.pdfReport
);

export default router;
