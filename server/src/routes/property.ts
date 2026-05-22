import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { UpsertPropertySchema, ApplicationIdParamSchema } from '../middleware/validate';
import * as ctrl from '../controllers/property';

const router = Router();

router.use(requireAuth);

// GET /property/:applicationId
router.get(
  '/:applicationId',
  validate(ApplicationIdParamSchema, 'params'),
  ctrl.getByApplication
);

// PUT /property/:applicationId
router.put(
  '/:applicationId',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(ApplicationIdParamSchema, 'params'),
  validate(UpsertPropertySchema),
  ctrl.upsert
);

export default router;
