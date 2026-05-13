import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  SaveDecisionSchema,
  ApplicationIdParamSchema,
} from '../middleware/validate';
import * as ctrl from '../controllers/underwriting';

const router = Router();

router.use(requireAuth);

// GET /underwriting/:applicationId/calculate — preview without saving
router.get(
  '/:applicationId/calculate',
  validate(ApplicationIdParamSchema, 'params'),
  ctrl.calculate
);

// GET /underwriting/:applicationId/decisions — history
router.get(
  '/:applicationId/decisions',
  validate(ApplicationIdParamSchema, 'params'),
  ctrl.listDecisions
);

// POST /underwriting/:applicationId/decide — save decision + update status
router.post(
  '/:applicationId/decide',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(ApplicationIdParamSchema, 'params'),
  validate(SaveDecisionSchema),
  ctrl.decide
);

export default router;
