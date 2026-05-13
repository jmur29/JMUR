import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import logger from '../utils/logger';

/**
 * Fire-and-forget audit log insert.
 * Errors are caught and logged — never propagated to callers.
 */
export function logAction(
  tenantId: string,
  userId: string,
  applicationId: string | null,
  action: string,
  // Accept a plain object and cast to Prisma's Json-compatible type
  metadata: Record<string, unknown>
): void {
  prisma.auditLog
    .create({
      data: {
        tenantId,
        userId,
        applicationId: applicationId ?? undefined,
        action,
        metadata: metadata as Prisma.InputJsonObject,
      },
    })
    .catch((err: unknown) => {
      logger.error('Failed to write audit log', {
        action,
        tenantId,
        userId,
        applicationId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
}
