import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { UuidParamSchema } from '../middleware/validate';
import * as ctrl from '../controllers/notes';

const router = Router({ mergeParams: true });

// All note routes require auth
router.use(requireAuth);

const NoteBodySchema = z.object({
  body: z.string().min(1).max(10000),
});

const NoteIdParamSchema = z.object({
  noteId: z.string().uuid(),
});

// GET /api/applications/:id/notes
router.get(
  '/',
  validate(UuidParamSchema, 'params'),
  ctrl.list
);

// POST /api/applications/:id/notes
router.post(
  '/',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(UuidParamSchema, 'params'),
  validate(NoteBodySchema),
  ctrl.create
);

// PATCH /api/notes/:noteId
router.patch(
  '/:noteId',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(NoteIdParamSchema, 'params'),
  validate(NoteBodySchema),
  ctrl.update
);

// DELETE /api/notes/:noteId
router.delete(
  '/:noteId',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(NoteIdParamSchema, 'params'),
  ctrl.remove
);

export default router;
