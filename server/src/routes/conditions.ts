import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { UuidParamSchema } from '../middleware/validate';
import * as ctrl from '../controllers/conditions';

const router = Router({ mergeParams: true });

router.use(requireAuth);

const CreateConditionSchema = z.object({
  body: z.string().min(1).max(5000),
});

const UpdateConditionSchema = z.object({
  body: z.string().min(1).max(5000).optional(),
  cleared: z.boolean().optional(),
});

const ConditionIdParamSchema = z.object({
  conditionId: z.string().uuid(),
});

// GET /api/applications/:id/conditions
router.get(
  '/',
  validate(UuidParamSchema, 'params'),
  ctrl.list
);

// POST /api/applications/:id/conditions
router.post(
  '/',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(UuidParamSchema, 'params'),
  validate(CreateConditionSchema),
  ctrl.create
);

// PATCH /api/conditions/:conditionId
router.patch(
  '/:conditionId',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(ConditionIdParamSchema, 'params'),
  validate(UpdateConditionSchema),
  ctrl.update
);

// DELETE /api/conditions/:conditionId
router.delete(
  '/:conditionId',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(ConditionIdParamSchema, 'params'),
  ctrl.remove
);

export default router;
