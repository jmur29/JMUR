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
  requireRole(['ADMIN', 'UNDERWRITER']),
  ctrl.create
);

router.get(
  '/:id',
  validate(UuidParamSchema, 'params'),
  ctrl.getById
);

router.patch(
  '/:id',
  requireRole(['ADMIN', 'UNDERWRITER']),
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

export default router;
