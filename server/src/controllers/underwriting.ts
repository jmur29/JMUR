import { Request, Response, NextFunction } from 'express';
import {
  calculateUnderwriting,
  saveDecision,
  getDecisionsByApplication,
} from '../services/underwriting';

export async function calculate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await calculateUnderwriting(
      req.params.applicationId,
      req.user.tenantId
    );
    if ('error' in result) {
      res.status(422).json({ error: result.error, code: 'CALCULATION_ERROR' });
      return;
    }
    res.json(result.result);
  } catch (err) {
    next(err);
  }
}

export async function decide(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { notes } = req.body as { notes?: string };
    const result = await saveDecision(
      req.params.applicationId,
      req.user.tenantId,
      req.user.id,
      notes
    );
    if ('error' in result) {
      res.status(422).json({ error: result.error, code: 'CALCULATION_ERROR' });
      return;
    }
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listDecisions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const decisions = await getDecisionsByApplication(
      req.params.applicationId,
      req.user.tenantId
    );
    if (decisions === null) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(decisions);
  } catch (err) {
    next(err);
  }
}
