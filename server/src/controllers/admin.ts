import { Request, Response, NextFunction } from 'express';
import { listUsers, updateUserRole, getPipelineStats, listAuditLogs, getTenant, updateTenant, uploadTenantLogo } from '../services/admin';
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

export async function auditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { applicationId, userId, action, page, pageSize } = req.query as Record<string, string | undefined>;
    const result = await listAuditLogs(req.user.tenantId, {
      applicationId,
      userId,
      action,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
    res.json({ data: result.data, total: result.total, page: page ? parseInt(page, 10) : 1, pageSize: pageSize ? parseInt(pageSize, 10) : 20 });
  } catch (err) {
    next(err);
  }
}

export async function getTenantSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getTenant(req.user.tenantId);
    if (!result) {
      res.status(404).json({ error: 'Tenant not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateTenantSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, primaryColor, logoUrl } = req.body as {
      name?: string;
      primaryColor?: string;
      logoUrl?: string;
    };
    const result = await updateTenant(req.user.tenantId, { name, primaryColor, logoUrl });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function uploadLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded', code: 'BAD_REQUEST' });
      return;
    }

    const result = await uploadTenantLogo(
      req.user.tenantId,
      req.user.id,
      file.buffer,
      file.mimetype,
      file.originalname
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
