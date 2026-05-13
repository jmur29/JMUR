import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/backend';
import prisma from '../prisma/client';
import logger from '../utils/logger';

// Extend Express Request to carry authenticated user context
declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        tenantId: string;
        clerkId: string;
        role: 'ADMIN' | 'UNDERWRITER' | 'VIEWER';
      };
      tenant: {
        id: string;
        name: string;
        slug: string;
        logoUrl: string | null;
        primaryColor: string;
        createdAt: Date;
      };
    }
  }
}

/**
 * Verify Clerk session token and populate req.user from the database.
 * The token must carry a public metadata claim `tenantId`.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing bearer token', code: 'UNAUTHORIZED' });
      return;
    }

    const token = authHeader.slice(7);

    // Verify with Clerk — throws if invalid/expired
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY ?? '',
    });

    const clerkUserId = payload.sub;

    // Look up the local user record
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: {
        id: true,
        tenantId: true,
        clerkId: true,
        role: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt !== null) {
      res.status(401).json({ error: 'User not found or deactivated', code: 'UNAUTHORIZED' });
      return;
    }

    req.user = {
      id: user.id,
      tenantId: user.tenantId,
      clerkId: user.clerkId,
      role: user.role as 'ADMIN' | 'UNDERWRITER' | 'VIEWER',
    };

    next();
  } catch (err) {
    logger.warn('Auth failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
  }
}

/**
 * Role guard — call after requireAuth.
 * requireRole(['ADMIN', 'UNDERWRITER']) allows either role.
 */
export function requireRole(roles: Array<'ADMIN' | 'UNDERWRITER' | 'VIEWER'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Requires one of: ${roles.join(', ')}`,
        code: 'FORBIDDEN',
      });
      return;
    }
    next();
  };
}
