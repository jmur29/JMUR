import { type StatusHistory } from '@prisma/client';
import prisma from '../prisma/client';
import logger from '../utils/logger';

// Re-export the Prisma type for use by consumers
export type { StatusHistory };

/**
 * Creates a StatusHistory record for a status transition.
 * Fire-and-forget — errors are caught and logged, not rethrown.
 */
export async function recordStatusChange(opts: {
  applicationId: string;
  fromStatus: string | null;
  toStatus: string;
  changedById: string;
  note?: string;
}): Promise<void> {
  prisma.statusHistory
    .create({
      data: {
        applicationId: opts.applicationId,
        fromStatus: opts.fromStatus as Parameters<typeof prisma.statusHistory.create>[0]['data']['fromStatus'],
        toStatus: opts.toStatus as Parameters<typeof prisma.statusHistory.create>[0]['data']['toStatus'],
        changedById: opts.changedById,
        note: opts.note,
      },
    })
    .catch((err: unknown) => {
      logger.error('Failed to record status change', {
        error: err instanceof Error ? err.message : String(err),
        applicationId: opts.applicationId,
        fromStatus: opts.fromStatus,
        toStatus: opts.toStatus,
      });
    });
}

/**
 * Returns status history for an application ordered by createdAt ascending,
 * with the changedBy user included.
 */
export async function getStatusHistory(applicationId: string): Promise<
  (StatusHistory & {
    changedBy: { id: string; firstName: string; lastName: string; email: string };
  })[]
> {
  return prisma.statusHistory.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'asc' },
    include: {
      changedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  }) as Promise<
    (StatusHistory & {
      changedBy: { id: string; firstName: string; lastName: string; email: string };
    })[]
  >;
}
