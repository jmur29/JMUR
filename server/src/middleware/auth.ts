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
  const reqId = Math.random().toString(36).slice(2, 8);
  const route = `${req.method} ${req.path}`;
  logger.info(`[auth:${reqId}] ${route} — start`);

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn(`[auth:${reqId}] ${route} — missing bearer token`);
      res.status(401).json({ error: 'Missing bearer token', code: 'UNAUTHORIZED' });
      return;
    }

    const token = authHeader.slice(7);
    logger.info(`[auth:${reqId}] ${route} — verifying Clerk token (len=${token.length})`);

    // Verify with Clerk — throws if invalid/expired
    let payload: Awaited<ReturnType<typeof verifyToken>>;
    try {
      payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY ?? '',
      });
    } catch (verifyErr) {
      logger.warn(`[auth:${reqId}] ${route} — Clerk verifyToken failed: ${verifyErr instanceof Error ? verifyErr.message : String(verifyErr)}`);
      res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
      return;
    }

    const clerkUserId = payload.sub;
    logger.info(`[auth:${reqId}] ${route} — token valid, clerkId=${clerkUserId}`);

    // Look up the local user record
    let user: { id: string; tenantId: string; clerkId: string; role: string; deletedAt: Date | null } | null;
    try {
      user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: {
          id: true,
          tenantId: true,
          clerkId: true,
          role: true,
          deletedAt: true,
        },
      });
    } catch (dbErr) {
      logger.error(`[auth:${reqId}] ${route} — DB lookup failed: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
      res.status(500).json({ error: 'Database error during auth lookup', code: 'SERVER_ERROR' });
      return;
    }

    if (user) {
      logger.info(`[auth:${reqId}] ${route} — found user in DB: id=${user.id} role=${user.role} deletedAt=${user.deletedAt}`);
    } else {
      logger.info(`[auth:${reqId}] ${route} — user NOT in DB, starting auto-provision for clerkId=${clerkUserId}`);
    }

    if (!user) {
      // Auto-provision: fetch user details from Clerk and create the DB record
      try {
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY ?? '' });
        logger.info(`[auth:${reqId}] ${route} — calling Clerk API for user details`);
        const clerkUser = await clerk.users.getUser(clerkUserId);
        const meta = (clerkUser.publicMetadata ?? {}) as { tenantId?: string; role?: string };
        logger.info(`[auth:${reqId}] ${route} — Clerk publicMetadata: ${JSON.stringify(meta)}`);

        const rawRole = meta.role;
        const role: UserRole = (rawRole && (VALID_ROLES as readonly string[]).includes(rawRole)
          ? rawRole
          : 'BROKER') as UserRole;
        logger.info(`[auth:${reqId}] ${route} — resolved role=${role} (rawRole=${rawRole})`);

        let tenantId = meta.tenantId;

        // Validate tenant exists if provided
        if (tenantId) {
          logger.info(`[auth:${reqId}] ${route} — checking tenant exists: ${tenantId}`);
          const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
          if (existing) {
            logger.info(`[auth:${reqId}] ${route} — tenant found: ${tenantId}`);
          } else {
            logger.warn(`[auth:${reqId}] ${route} — tenantId ${tenantId} not in DB, will create new tenant`);
            tenantId = undefined;
          }
        }

        // Create a new tenant if none resolved
        if (!tenantId) {
          const slug = `t-${clerkUserId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-12)}-${Date.now()}`;
          const emailDomain = clerkUser.emailAddresses[0]?.emailAddress?.split('@')[1] ?? 'clearpath';
          logger.info(`[auth:${reqId}] ${route} — creating new tenant slug=${slug} name=${emailDomain}`);
          const newTenant = await prisma.tenant.create({
            data: { name: emailDomain, slug },
          });
          tenantId = newTenant.id;
          logger.info(`[auth:${reqId}] ${route} — created tenant id=${tenantId}`);
        }

        const primaryEmail = clerkUser.emailAddresses.find(
          (e) => e.id === clerkUser.primaryEmailAddressId
        );
        const email = primaryEmail?.emailAddress ?? '';
        logger.info(`[auth:${reqId}] ${route} — creating user email=${email} role=${role} tenantId=${tenantId}`);

        user = await prisma.user.create({
          data: {
            clerkId: clerkUserId,
            tenantId,
            firstName: clerkUser.firstName ?? '',
            lastName: clerkUser.lastName ?? '',
            email,
            role,
          },
          select: { id: true, tenantId: true, clerkId: true, role: true, deletedAt: true },
        });

        logger.info(`[auth:${reqId}] ${route} — auto-provisioned user id=${user.id}`);

        // Seed demo data if tenant has no applications yet (fire-and-forget)
        seedForTenant(tenantId, user.id).catch((err) =>
          logger.error(`[auth:${reqId}] auto-seed failed for tenant ${tenantId}: ${err instanceof Error ? err.message : String(err)}`)
        );
      } catch (provisionErr) {
        const msg = provisionErr instanceof Error ? provisionErr.message : String(provisionErr);
        logger.error(`[auth:${reqId}] ${route} — auto-provisioning FAILED: ${msg}`);
        res.status(503).json({
          error: `Account setup failed — ${msg}`,
          code: 'PROVISIONING_FAILED',
        });
        return;
      }
    }

    if (user.deletedAt !== null) {
      logger.warn(`[auth:${reqId}] ${route} — user is soft-deleted`);
      res.status(401).json({ error: 'User deactivated', code: 'UNAUTHORIZED' });
      return;
    }

    logger.info(`[auth:${reqId}] ${route} — auth OK, user=${user.id} role=${user.role}`);
    req.user = {
      id: user.id,
      tenantId: user.tenantId,
      clerkId: user.clerkId,
      role: user.role as UserRole,
    };

    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[auth:${reqId}] ${route} — unhandled error: ${msg}`);
    res.status(500).json({ error: `Auth middleware error — ${msg}`, code: 'SERVER_ERROR' });
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
