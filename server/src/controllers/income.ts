import { Request, Response, NextFunction } from 'express';
import { upsertIncome, getIncomeByBorrower } from '../services/income';

export async function getByBorrower(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const income = await getIncomeByBorrower(req.params.borrowerId, req.user.tenantId);
    if (income === null) {
      res.status(404).json({ error: 'Borrower not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(income);
  } catch (err) {
    next(err);
  }
}

export async function upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const income = await upsertIncome(
      req.params.borrowerId,
      req.body,
      req.user.tenantId,
      req.user.id
    );
    if (income === null) {
      res.status(404).json({ error: 'Borrower not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(income);
  } catch (err) {
    next(err);
  }
}
