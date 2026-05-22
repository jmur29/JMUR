import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { UpdateUserRoleSchema } from '../middleware/validate';
import * as ctrl from '../controllers/admin';

const router = Router();

// All admin routes require ADMIN role
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

// GET /admin/users
router.get('/users', ctrl.users);

// PATCH /admin/users/:userId/role
router.patch(
  '/users/:userId/role',
  validate(z.object({ userId: z.string().uuid() }), 'params'),
  validate(UpdateUserRoleSchema),
  ctrl.updateRole
);

// GET /admin/stats
router.get('/stats', ctrl.stats);

export default router;
