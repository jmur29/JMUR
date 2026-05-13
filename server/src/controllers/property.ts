import { Request, Response, NextFunction } from 'express';
import { upsertProperty, getPropertyByApplication } from '../services/property';

export async function getByApplication(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const property = await getPropertyByApplication(
      req.params.applicationId,
      req.user.tenantId
    );
    if (property === null) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(property);
  } catch (err) {
    next(err);
  }
}

export async function upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const property = await upsertProperty(
      req.params.applicationId,
      req.body,
      req.user.tenantId,
      req.user.id
    );
    if (property === null) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(property);
  } catch (err) {
    next(err);
  }
}
