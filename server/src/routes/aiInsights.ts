import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as ctrl from '../controllers/aiInsights';

const router = Router({ mergeParams: true });

router.use(requireAuth);

// GET /api/applications/:id/documents/classified
router.get('/documents/classified', ctrl.getClassifiedDocuments);

// GET /api/applications/:id/down-payment
router.get('/down-payment', ctrl.getDownPayment);

// GET /api/applications/:id/fraud-signals
router.get('/fraud-signals', ctrl.getFraudSignals);

// POST /api/applications/:id/fraud-signals/:signalId/acknowledge
router.post('/fraud-signals/:signalId/acknowledge', ctrl.acknowledgeFraudSignal);

// GET /api/applications/:id/credit-memo
router.get('/credit-memo', ctrl.getCreditMemo);

// POST /api/applications/:id/credit-memo/pdf
router.post('/credit-memo/pdf', ctrl.generateCreditMemoPdf);

// GET /api/applications/:id/submission-notes
router.get('/submission-notes', ctrl.getSubmissionNotes);

// POST /api/applications/:id/submission-notes/generate
router.post('/submission-notes/generate', ctrl.generateSubmissionNotes);

// POST /api/applications/:id/submission-notes/finalize
router.post('/submission-notes/finalize', ctrl.finalizeSubmissionNotes);

// GET /api/applications/:id/conditions/anticipated
router.get('/conditions/anticipated', ctrl.getAnticipatedConditions);

export default router;
