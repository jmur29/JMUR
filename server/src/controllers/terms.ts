import { Request, Response, NextFunction } from 'express';
import { upsertTerms, getTermsByApplication } from '../services/terms';

export async function getByApplication(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const terms = await getTermsByApplication(
      req.params.applicationId,
      req.user.tenantId
    );
    if (terms === null) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(terms);
  } catch (err) {
    next(err);
  }
}

export async function upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const terms = await upsertTerms(
      req.params.applicationId,
      req.body,
      req.user.tenantId,
      req.user.id
    );
    if (terms === null) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(terms);
  } catch (err) {
    next(err);
  }
}
