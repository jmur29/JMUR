import { Request, Response, NextFunction } from 'express';
import { parseSubmissionNote, reviewUnderwritingFile } from '../services/ai';
import prisma from '../prisma/client';

export async function parseSubmission(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { text } = req.body as { text: string };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'Request body must include a non-empty text field', code: 'BAD_REQUEST' });
      return;
    }

    const parsed = await parseSubmissionNote(text);
    res.json(parsed);
  } catch (err) {
    next(err);
  }
}

export async function reviewFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { applicationId } = req.body as { applicationId: string };

    if (!applicationId || typeof applicationId !== 'string') {
      res.status(400).json({ error: 'Request body must include applicationId', code: 'BAD_REQUEST' });
      return;
    }

    const application = await prisma.application.findFirst({
      where: { id: applicationId, tenantId: req.user.tenantId, deletedAt: null },
      include: {
        borrowers: { include: { income: true } },
        property: true,
        mortgageTerms: true,
        decisions: {
          orderBy: { decidedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!application) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }

    const review = await reviewUnderwritingFile(application);
    res.json(review);
  } catch (err) {
    next(err);
  }
}
