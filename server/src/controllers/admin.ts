import { Request, Response, NextFunction } from 'express';
import { listUsers, updateUserRole, getPipelineStats } from '../services/admin';
import type { UserRole } from '@prisma/client';

export async function users(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listUsers(req.user.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateRole(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { role } = req.body as { role: UserRole };
    const result = await updateUserRole(
      req.params.userId,
      req.user.tenantId,
      req.user.id,
      role
    );
    if (!result) {
      res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function stats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getPipelineStats(req.user.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
