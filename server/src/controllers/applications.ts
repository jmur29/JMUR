import { Request, Response, NextFunction } from 'express';
import {
  listApplications,
  createApplication,
  getApplicationById,
  updateApplication,
  softDeleteApplication,
} from '../services/applications';
import { getStatusHistory } from '../services/statusHistory';
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

export async function getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await getStatusHistory(req.params.id);
    res.json(history);
  } catch (err) {
    next(err);
  }
}
