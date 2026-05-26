import { Request, Response, NextFunction } from 'express';
import { verifyToken, createClerkClient } from '@clerk/backend';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import { seedForTenant } from '../utils/autoSeed';

type UserRole = 'ADMIN' | 'BROKER' | 'UNDERWRITER' | 'VIEWER';

// Extend Express Request to carry authenticated user context
declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        tenantId: string;
        clerkId: string;
        role: UserRole;
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

const VALID_ROLES: readonly UserRole[] = ['ADMIN', 'BROKER', 'UNDERWRITER', 'VIEWER'];

/**
 * Verify Clerk session token and populate req.user from the database.
 * Auto-provisions tenant + user if the Clerk token is valid but the user
 * doesn't exist in the local DB yet (e.g. webhook hasn't fired yet).
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
    let user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: {
        id: true,
        tenantId: true,
        clerkId: true,
        role: true,
        deletedAt: true,
      },
    });

    if (!user) {
      // Auto-provision: fetch user details from Clerk and create the DB record
      try {
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY ?? '' });
        const clerkUser = await clerk.users.getUser(clerkUserId);
        const meta = (clerkUser.publicMetadata ?? {}) as { tenantId?: string; role?: string };

        const rawRole = meta.role;
        const role: UserRole = (rawRole && (VALID_ROLES as readonly string[]).includes(rawRole)
          ? rawRole
          : 'BROKER') as UserRole;

        let tenantId = meta.tenantId;

        // Validate tenant exists if provided
        if (tenantId) {
          const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
          if (!existing) tenantId = undefined;
        }

        // Create a new tenant if none resolved
        if (!tenantId) {
          const slug = `t-${clerkUserId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-12)}-${Date.now()}`;
          const emailDomain = clerkUser.emailAddresses[0]?.emailAddress?.split('@')[1] ?? 'clearpath';
          const newTenant = await prisma.tenant.create({
            data: { name: emailDomain, slug },
          });
          tenantId = newTenant.id;
        }

        const primaryEmail = clerkUser.emailAddresses.find(
          (e) => e.id === clerkUser.primaryEmailAddressId
        );

        user = await prisma.user.create({
          data: {
            clerkId: clerkUserId,
            tenantId,
            firstName: clerkUser.firstName ?? '',
            lastName: clerkUser.lastName ?? '',
            email: primaryEmail?.emailAddress ?? '',
            role,
          },
          select: { id: true, tenantId: true, clerkId: true, role: true, deletedAt: true },
        });

        logger.info('Auto-provisioned user', { clerkId: clerkUserId, tenantId, role });

        // Seed demo data if tenant has no applications yet (fire-and-forget)
        seedForTenant(tenantId, user.id).catch((err) =>
          logger.error('Auto-seed failed for tenant', { tenantId, err })
        );
      } catch (provisionErr) {
        logger.error('Auto-provisioning failed', {
          clerkId: clerkUserId,
          error: provisionErr instanceof Error ? provisionErr.message : String(provisionErr),
        });
        res.status(401).json({ error: 'User not found', code: 'UNAUTHORIZED' });
        return;
      }
    }

    if (user.deletedAt !== null) {
      res.status(401).json({ error: 'User deactivated', code: 'UNAUTHORIZED' });
      return;
    }

    req.user = {
      id: user.id,
      tenantId: user.tenantId,
      clerkId: user.clerkId,
      role: user.role as UserRole,
    };

    next();
  } catch (err) {
    logger.warn('Auth failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
  }
}

/**
 * Role guard — call after requireAuth.
 * requireRole(['ADMIN', 'BROKER', 'UNDERWRITER']) allows any of those roles.
 */
export function requireRole(roles: Array<UserRole>) {
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
