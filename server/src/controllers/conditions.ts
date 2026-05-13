import { Request, Response, NextFunction } from 'express';
import {
  listConditions,
  createCondition,
  updateCondition,
  deleteCondition,
} from '../services/conditions';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listConditions(req.params.id, req.user.tenantId);
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
    const { body } = req.body as { body: string };
    const result = await createCondition(
      req.params.id,
      body,
      req.user.tenantId,
      req.user.id
    );
    if (result === null) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body as { body?: string; cleared?: boolean };
    const result = await updateCondition(
      req.params.conditionId,
      req.user.tenantId,
      req.user.id,
      { ...data, clearedById: req.user.id }
    );
    if (result === null) {
      res.status(404).json({ error: 'Condition not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await deleteCondition(
      req.params.conditionId,
      req.user.tenantId,
      req.user.id
    );
    if (result === null) {
      res.status(404).json({ error: 'Condition not found', code: 'NOT_FOUND' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
