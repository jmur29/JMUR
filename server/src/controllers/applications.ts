import { Request, Response, NextFunction } from 'express';
import {
  listApplications,
  createApplication,
  getApplicationById,
  updateApplication,
  softDeleteApplication,
} from '../services/applications';
import { generateDealIntelligenceFromApplication } from '../services/intake';
import { buildDealReview } from '../services/ai';
import prisma from '../prisma/client';
import type { ApplicationStatus } from '@prisma/client';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as {
      status?: ApplicationStatus;
      assignedToId?: string;
      cursor?: string;
      limit?: string;
    };

    const result = await listApplications({
      tenantId: req.user.tenantId,
      status: query.status,
      assignedToId: query.assignedToId,
      cursor: query.cursor,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const application = await createApplication(req.user.tenantId, req.user.id);
    res.status(201).json(application);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const application = await getApplicationById(req.params.id, req.user.tenantId);
    if (!application) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(application);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await updateApplication(
      req.params.id,
      req.user.tenantId,
      req.user.id,
      req.body as { status?: ApplicationStatus; assignedToId?: string | null }
    );
    if (!result) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await softDeleteApplication(req.params.id, req.user.tenantId, req.user.id);
    if (!result) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getDealIntelligence(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const application = await prisma.application.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId, deletedAt: null },
      select: { id: true, dealIntelligenceReport: true, processingStatus: true },
    });

    if (!application) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }

    if (!application.dealIntelligenceReport) {
      res.status(404).json({
        error: 'Report not yet generated',
        code: 'NOT_READY',
        processingStatus: application.processingStatus,
      });
      return;
    }

    res.json(application.dealIntelligenceReport);
  } catch (err) {
    next(err);
  }
}

export async function getDealReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const application = await prisma.application.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId, deletedAt: null },
      select: { id: true, dealReviewReport: true, processingStatus: true },
    });

    if (!application) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }

    if (!application.dealReviewReport) {
      res.status(404).json({
        error: 'Report not yet generated',
        code: 'NOT_READY',
        processingStatus: application.processingStatus,
      });
      return;
    }

    res.json(application.dealReviewReport);
  } catch (err) {
    next(err);
  }
}

export async function generateDealIntelligence(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const application = await prisma.application.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId, deletedAt: null },
      select: { id: true, processingStatus: true },
    });

    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    if (application.processingStatus === 'PROCESSING') {
      res.status(409).json({ error: 'Already processing', code: 'ALREADY_PROCESSING' });
      return;
    }

    // Kick off async generation from existing application data
    generateDealIntelligenceFromApplication(application.id, req.user.tenantId).catch(console.error);

    res.json({ status: 'PROCESSING', applicationId: application.id });
  } catch (err) {
    next(err);
  }
}

export async function generateDealReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const application = await prisma.application.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId, deletedAt: null },
      include: {
        borrowers: { include: { income: true } },
        property: true,
        mortgageTerms: true,
        documents: true,
        decisions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    // Build deal review async
    (async () => {
      try {
        await prisma.application.update({
          where: { id: application.id },
          data: { processingStatus: 'PROCESSING' },
        });

        const report = await buildDealReview(application, []);
        await prisma.application.update({
          where: { id: application.id },
          data: {
            processingStatus: 'COMPLETE',
            dealReviewReport: report as unknown as Record<string, unknown>,
          },
        });
      } catch (err) {
        await prisma.application.update({
          where: { id: application.id },
          data: { processingStatus: 'FAILED' },
        });
        console.error('generateDealReview failed', err);
      }
    })();

    res.json({ status: 'PROCESSING', applicationId: application.id });
  } catch (err) {
    next(err);
  }
}
