import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { UpsertTermsSchema, ApplicationIdParamSchema } from '../middleware/validate';
import * as ctrl from '../controllers/terms';

const router = Router();

router.use(requireAuth);

// GET /terms/:applicationId
router.get(
  '/:applicationId',
  validate(ApplicationIdParamSchema, 'params'),
  ctrl.getByApplication
);

// PUT /terms/:applicationId
router.put(
  '/:applicationId',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(ApplicationIdParamSchema, 'params'),
  validate(UpsertTermsSchema),
  ctrl.upsert
);

export default router;
