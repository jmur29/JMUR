import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';

// ─── getBrokerDashboard ────────────────────────────────────────────────────────

export async function getBrokerDashboard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tenantId } = req.user;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Active files (not APPROVED, DECLINED, or soft-deleted)
    const activeFiles = await prisma.application.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { notIn: ['APPROVED', 'DECLINED'] },
      },
    });

    // Submitted this month
    const submittedThisMonth = await prisma.application.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'CONDITIONALLY_APPROVED'] },
        updatedAt: { gte: startOfMonth },
      },
    });

    // Avg anticipated conditions per file (from submission notes)
    const submissionNotes = await prisma.submissionNote.findMany({
      where: { tenantId },
      select: { anticipatedConditions: true },
    });

    let avgConditionsPerFile = 0;
    if (submissionNotes.length > 0) {
      const total = submissionNotes.reduce((sum, n) => {
        const arr = (n.anticipatedConditions as string[] | null) ?? [];
        return sum + arr.length;
      }, 0);
      avgConditionsPerFile = parseFloat((total / submissionNotes.length).toFixed(1));
    }

    // Files with open (unacknowledged) fraud flags
    const filesWithOpenFlags = await prisma.application.count({
      where: {
        tenantId,
        deletedAt: null,
        documents: {
          some: {
            fraudSignals: {
              some: { acknowledgedAt: null },
            },
          },
        },
      },
    });

    // Recent activity — last 10 status history events
    const recentActivity = await prisma.statusHistory.findMany({
      where: { application: { tenantId, deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        application: { select: { id: true, fileNumber: true } },
        changedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json({
      success: true,
      data: {
        activeFiles,
        submittedThisMonth,
        avgConditionsPerFile,
        filesWithOpenFlags,
        recentActivity,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── getLenderDashboard ───────────────────────────────────────────────────────

export async function getLenderDashboard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tenantId } = req.user;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Files in review
    const filesInReview = await prisma.application.count({
      where: { tenantId, deletedAt: null, status: 'IN_REVIEW' },
    });

    // Approved this month
    const approvedThisMonth = await prisma.application.count({
      where: {
        tenantId,
        deletedAt: null,
        status: 'APPROVED',
        updatedAt: { gte: startOfMonth },
      },
    });

    // Manual review queue — CONDITIONALLY_APPROVED or MANUAL_REVIEW decision
    const manualReviewQueue = await prisma.application.count({
      where: {
        tenantId,
        deletedAt: null,
        status: 'CONDITIONALLY_APPROVED',
      },
    });

    // High-severity fraud signals (unacknowledged)
    const highSeverityFraudSignals = await prisma.fraudSignal.count({
      where: {
        tenantId,
        severity: 'HIGH',
        acknowledgedAt: null,
      },
    });

    // Currently processing files (pipeline status — count from in-memory map would be richer,
    // but for DB-backed view use READY_TO_SUBMIT status as proxy)
    const processingFiles = await prisma.application.count({
      where: {
        tenantId,
        deletedAt: null,
        status: 'READY_TO_SUBMIT',
      },
    });

    res.json({
      success: true,
      data: {
        filesInReview,
        approvedThisMonth,
        manualReviewQueue,
        highSeverityFraudSignals,
        processingFiles,
      },
    });
  } catch (err) {
    next(err);
  }
}
