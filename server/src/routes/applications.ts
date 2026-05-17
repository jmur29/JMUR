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

// Search — must come before /:id to avoid conflict
router.get('/search', ctrl.search);

router.post(
  '/',
  requireRole(['ADMIN', 'UNDERWRITER']),
  ctrl.create
);

router.post(
  '/:id/duplicate',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(UuidParamSchema, 'params'),
  ctrl.duplicate
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

// GET /applications/:id/history — returns status history for an application
router.get(
  '/:id/history',
  validate(UuidParamSchema, 'params'),
  ctrl.getHistory
);

export default router;
