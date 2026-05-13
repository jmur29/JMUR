import { Prisma, ApplicationStatus } from '@prisma/client';
import prisma from '../prisma/client';
import { generateFileNumber } from '../utils/fileNumber';
import { logAction } from './audit';
import { sendAssignmentEmail, sendStatusChangeEmail } from './email';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListApplicationsOptions {
  tenantId: string;
  status?: ApplicationStatus;
  assignedToId?: string;
  cursor?: string;
  limit: number;
}

export interface UpdateApplicationInput {
  status?: ApplicationStatus;
  assignedToId?: string | null;
}

// ─── Full include for getById ─────────────────────────────────────────────────

const APPLICATION_FULL_INCLUDE = {
  borrowers: {
    include: { income: true },
  },
  property: true,
  mortgageTerms: true,
  decisions: {
    orderBy: { decidedAt: 'desc' as const },
    include: { decidedBy: { select: { id: true, firstName: true, lastName: true } } },
  },
  documents: {
    orderBy: { uploadedAt: 'desc' as const },
    include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
  },
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.ApplicationInclude;

// ─── Service functions ────────────────────────────────────────────────────────

export async function listApplications(opts: ListApplicationsOptions) {
  const where: Prisma.ApplicationWhereInput = {
    tenantId: opts.tenantId,
    deletedAt: null,
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.assignedToId ? { assignedToId: opts.assignedToId } : {}),
  };

  const applications = await prisma.application.findMany({
    where,
    take: opts.limit + 1, // fetch one extra to determine if there's a next page
    ...(opts.cursor
      ? {
          cursor: { id: opts.cursor },
          skip: 1,
        }
      : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      borrowers: { select: { id: true, firstName: true, lastName: true, type: true } },
      _count: { select: { documents: true } },
    },
  });

  const hasNextPage = applications.length > opts.limit;
  const items = hasNextPage ? applications.slice(0, opts.limit) : applications;
  const nextCursor = hasNextPage ? items[items.length - 1].id : null;

  return { items, nextCursor, hasNextPage };
}

export async function createApplication(tenantId: string, userId: string) {
  const fileNumber = await generateFileNumber(tenantId, prisma);

  const application = await prisma.application.create({
    data: {
      tenantId,
      fileNumber,
      status: 'DRAFT',
    },
    include: APPLICATION_FULL_INCLUDE,
  });

  logAction(tenantId, userId, application.id, 'APPLICATION_CREATED', { fileNumber });

  return application;
}

export async function getApplicationById(id: string, tenantId: string) {
  const application = await prisma.application.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: APPLICATION_FULL_INCLUDE,
  });

  return application;
}

export async function updateApplication(
  id: string,
  tenantId: string,
  userId: string,
  data: UpdateApplicationInput
) {
  const existing = await prisma.application.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!existing) return null;

  const updated = await prisma.application.update({
    where: { id },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.assignedToId !== undefined
        ? { assignedToId: data.assignedToId }
        : {}),
    },
    include: APPLICATION_FULL_INCLUDE,
  });

  logAction(tenantId, userId, id, 'APPLICATION_UPDATED', {
    changes: data as unknown as Record<string, unknown>,
    previousStatus: existing.status,
  });

  const appBase = process.env.APP_URL ?? 'http://localhost:3000';
  const applicationUrl = `${appBase}/applications/${id}`;

  // Assignment email — when assignedToId changes to a new user
  if (data.assignedToId && data.assignedToId !== existing.assignedToId) {
    const [newAssignee, borrowers, assigner] = await Promise.all([
      prisma.user.findUnique({
        where: { id: data.assignedToId },
        select: { email: true, firstName: true, lastName: true },
      }),
      prisma.borrower.findMany({
        where: { applicationId: id },
        select: { type: true, firstName: true, lastName: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      }),
    ]);

    if (newAssignee && assigner) {
      const primary = borrowers.find((b) => b.type === 'PRIMARY');
      const borrowerName = primary ? `${primary.firstName} ${primary.lastName}` : 'Unknown Borrower';
      sendAssignmentEmail({
        to: newAssignee.email,
        recipientName: `${newAssignee.firstName} ${newAssignee.lastName}`,
        fileNumber: updated.fileNumber,
        borrowerName,
        assignedByName: `${assigner.firstName} ${assigner.lastName}`,
        applicationUrl,
      }).catch(() => {/* already logged */});
    }
  }

  // Status change email — notify assigned underwriter when status changes
  if (data.status && data.status !== existing.status && updated.assignedTo) {
    sendStatusChangeEmail({
      to: updated.assignedTo.email,
      recipientName: `${updated.assignedTo.firstName} ${updated.assignedTo.lastName}`,
      fileNumber: updated.fileNumber,
      fromStatus: existing.status,
      toStatus: data.status,
      applicationUrl,
    }).catch(() => {/* already logged */});
  }

  return updated;
}

export async function softDeleteApplication(
  id: string,
  tenantId: string,
  userId: string
) {
  const existing = await prisma.application.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!existing) return null;

  const deleted = await prisma.application.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  logAction(tenantId, userId, id, 'APPLICATION_DELETED', {});

  return deleted;
}
