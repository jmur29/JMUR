import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  ListApplicationsQuerySchema,
  UpdateApplicationSchema,
  UuidParamSchema,
} from '../middleware/validate';
import * as ctrl from '../controllers/applications';

const router = Router();

// All application routes require auth
router.use(requireAuth);

router.get('/', validate(ListApplicationsQuerySchema, 'query'), ctrl.list);

router.post(
  '/',
  requireRole(['ADMIN', 'BROKER', 'UNDERWRITER']),
  ctrl.create
);

router.get(
  '/:id',
  validate(UuidParamSchema, 'params'),
  ctrl.getById
);

router.patch(
  '/:id',
  requireRole(['ADMIN', 'BROKER', 'UNDERWRITER']),
  validate(UuidParamSchema, 'params'),
  validate(UpdateApplicationSchema),
  ctrl.update
);

router.delete(
  '/:id',
  requireRole(['ADMIN']),
  validate(UuidParamSchema, 'params'),
  ctrl.remove
);

router.get(
  '/:id/deal-intelligence',
  validate(UuidParamSchema, 'params'),
  ctrl.getDealIntelligence
);

router.get(
  '/:id/deal-review',
  validate(UuidParamSchema, 'params'),
  ctrl.getDealReview
);

router.post(
  '/:id/deal-intelligence',
  validate(UuidParamSchema, 'params'),
  ctrl.generateDealIntelligence
);

router.post(
  '/:id/deal-review',
  validate(UuidParamSchema, 'params'),
  ctrl.generateDealReview
);

router.patch(
  '/:id/fraud-signals/:signalId/acknowledge',
  validate(UuidParamSchema, 'params'),
  ctrl.acknowledgeFraudSignal
);

export default router;
