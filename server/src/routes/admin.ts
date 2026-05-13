import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { UpdateUserRoleSchema } from '../middleware/validate';
import * as ctrl from '../controllers/admin';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const router = Router();

// All admin routes require auth
router.use(requireAuth);

// GET /admin/export — accessible to ADMIN and UNDERWRITER
router.get(
  '/export',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(
    z.object({
      status: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
    'query'
  ),
  ctrl.exportPipelineCsv
);

// Remaining admin routes require ADMIN role
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

// GET /admin/audit
router.get(
  '/audit',
  validate(
    z.object({
      applicationId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
      action: z.string().max(100).optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }),
    'query'
  ),
  ctrl.auditLogs
);

// GET /admin/tenant
router.get('/tenant', ctrl.getTenantSettings);

// PATCH /admin/tenant
router.patch(
  '/tenant',
  validate(
    z.object({
      name: z.string().min(1).max(200).optional(),
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').optional(),
      logoUrl: z.string().url().optional().nullable(),
    })
  ),
  ctrl.updateTenantSettings
);

// POST /admin/tenant/logo
router.post(
  '/tenant/logo',
  upload.single('logo'),
  ctrl.uploadLogo
);

export default router;
