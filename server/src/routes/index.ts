import { Router } from 'express';
import webhooksRouter from './webhooks';
import applicationsRouter from './applications';
import borrowersRouter from './borrowers';
import incomeRouter from './income';
import propertyRouter from './property';
import termsRouter from './terms';
import underwritingRouter from './underwriting';
import documentsRouter from './documents';
import reportsRouter from './reports';
import adminRouter from './admin';
import aiRouter from './ai';
import intakeRouter from './intake';

const router = Router();

// Webhooks (no auth — verified via svix signature)
router.use('/webhooks', webhooksRouter);

// Application CRUD
router.use('/applications', applicationsRouter);

// Borrower CRUD — includes sub-route for listing by application
router.use('/borrowers', borrowersRouter);

// Income upsert (per borrower)
router.use('/income', incomeRouter);

// Property upsert (per application)
router.use('/property', propertyRouter);

// Mortgage terms upsert (per application)
router.use('/terms', termsRouter);

// Underwriting engine
router.use('/underwriting', underwritingRouter);

// Document management
router.use('/documents', documentsRouter);

// PDF/HTML reports
router.use('/reports', reportsRouter);

// Admin — user management + stats
router.use('/admin', adminRouter);

// AI — document parsing + underwriting review
router.use('/ai', aiRouter);

// Intake — document processing pipeline (zip, finmo, submission notes)
router.use('/intake', intakeRouter);

export default router;
