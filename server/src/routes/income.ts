import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { UpsertIncomeSchema, BorrowerIdParamSchema } from '../middleware/validate';
import * as ctrl from '../controllers/income';

const router = Router();

router.use(requireAuth);

// GET /income/:borrowerId
router.get('/:borrowerId', validate(BorrowerIdParamSchema, 'params'), ctrl.getByBorrower);

// PUT /income/:borrowerId
router.put(
  '/:borrowerId',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(BorrowerIdParamSchema, 'params'),
  validate(UpsertIncomeSchema),
  ctrl.upsert
);

export default router;
