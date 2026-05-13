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
  metadata: Record<string, unknown>
): void {
  prisma.auditLog
    .create({
      data: {
        tenantId,
        userId,
        applicationId: applicationId ?? undefined,
        action,
        metadata,
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
