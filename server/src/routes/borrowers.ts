import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  CreateBorrowerSchema,
  UpdateBorrowerSchema,
  ApplicationIdParamSchema,
  BorrowerIdParamSchema,
} from '../middleware/validate';
import * as ctrl from '../controllers/borrowers';

const router = Router();

router.use(requireAuth);

// GET /applications/:applicationId/borrowers
router.get(
  '/applications/:applicationId/borrowers',
  validate(ApplicationIdParamSchema, 'params'),
  ctrl.listByApplication
);

// POST /borrowers
router.post(
  '/',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(CreateBorrowerSchema),
  ctrl.create
);

// PATCH /borrowers/:borrowerId
router.patch(
  '/:borrowerId',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(BorrowerIdParamSchema, 'params'),
  validate(UpdateBorrowerSchema),
  ctrl.update
);

// DELETE /borrowers/:borrowerId
router.delete(
  '/:borrowerId',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(BorrowerIdParamSchema, 'params'),
  ctrl.remove
);

export default router;
