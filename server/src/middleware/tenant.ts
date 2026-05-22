import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';

/**
 * Resolves tenant from req.user.tenantId and attaches it to req.tenant.
 * Must be placed after requireAuth.
 */
export async function requireTenant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
    });

    if (!tenant) {
      res.status(403).json({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' });
      return;
    }

    req.tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
}
