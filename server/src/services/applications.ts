import { Prisma, ApplicationStatus } from '@prisma/client';
import prisma from '../prisma/client';
import { generateFileNumber } from '../utils/fileNumber';
import { logAction } from './audit';

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
