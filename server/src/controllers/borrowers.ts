import { Request, Response, NextFunction } from 'express';
import {
  createBorrower,
  getBorrowersByApplication,
  updateBorrower,
  deleteBorrower,
} from '../services/borrowers';

export async function listByApplication(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await getBorrowersByApplication(
      req.params.applicationId,
      req.user.tenantId
    );
    if (result === null) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const borrower = await createBorrower(req.body, req.user.tenantId, req.user.id);
    res.status(201).json(borrower);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await updateBorrower(
      req.params.borrowerId,
      req.body,
      req.user.tenantId,
      req.user.id
    );
    if (!result) {
      res.status(404).json({ error: 'Borrower not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await deleteBorrower(
      req.params.borrowerId,
      req.user.tenantId,
      req.user.id
    );
    if (!result) {
      res.status(404).json({ error: 'Borrower not found', code: 'NOT_FOUND' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
