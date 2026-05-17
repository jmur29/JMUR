import { Prisma, ApplicationStatus } from '@prisma/client';
import prisma from '../prisma/client';
import { generateFileNumber } from '../utils/fileNumber';
import { logAction } from './audit';
import { sendAssignmentEmail, sendStatusChangeEmail } from './email';
import { recordStatusChange } from './statusHistory';
import { dispatchWebhook } from './webhooks';

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

export interface SearchResult {
  id: string;
  fileNumber: string;
  status: ApplicationStatus;
  borrowerName: string;
  borrowerEmail: string;
  createdAt: Date;
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
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
    include: { changedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
  },
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

  dispatchWebhook({
    event: 'application.created',
    tenantId,
    applicationId: application.id,
    fileNumber: application.fileNumber,
    timestamp: new Date().toISOString(),
    data: { status: application.status },
  }).catch(() => {/* already logged inside dispatchWebhook */});

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

  // Record status transition in history when status changes
  if (data.status && data.status !== existing.status) {
    recordStatusChange({
      applicationId: id,
      fromStatus: existing.status,
      toStatus: data.status,
      changedById: userId,
    });

    dispatchWebhook({
      event: 'application.status_changed',
      tenantId,
      applicationId: id,
      fileNumber: updated.fileNumber,
      timestamp: new Date().toISOString(),
      data: { fromStatus: existing.status, toStatus: data.status },
    }).catch(() => {/* already logged inside dispatchWebhook */});
  }

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

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchApplications(
  tenantId: string,
  q: string
): Promise<SearchResult[]> {
  const term = q.trim();
  const applications = await prisma.application.findMany({
    where: {
      tenantId,
      deletedAt: null,
      OR: [
        { fileNumber: { contains: term, mode: 'insensitive' } },
        {
          borrowers: {
            some: {
              OR: [
                { firstName: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
                { email: { contains: term, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      borrowers: {
        where: { type: 'PRIMARY' },
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });

  return applications.map((app) => {
    const primary = app.borrowers[0];
    return {
      id: app.id,
      fileNumber: app.fileNumber,
      status: app.status,
      borrowerName: primary ? `${primary.firstName} ${primary.lastName}` : '',
      borrowerEmail: primary?.email ?? '',
      createdAt: app.createdAt,
    };
  });
}

// ─── Duplicate ────────────────────────────────────────────────────────────────

export async function duplicateApplication(
  id: string,
  tenantId: string,
  requesterId: string
) {
  // 1. Load source application
  const source = await prisma.application.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      borrowers: { include: { income: true } },
      property: true,
      mortgageTerms: true,
    },
  });
  if (!source) return null;

  // 2. Generate new file number
  const newFileNumber = await generateFileNumber(tenantId, prisma);

  // 3. Create new application
  const newApp = await prisma.application.create({
    data: {
      tenantId,
      fileNumber: newFileNumber,
      status: 'DRAFT',
      assignedToId: null,
    },
  });

  // 4. Deep copy borrowers + income
  for (const borrower of source.borrowers) {
    const { id: _bid, applicationId: _appId, income, ...borrowerData } = borrower;
    const newBorrower = await prisma.borrower.create({
      data: { ...borrowerData, applicationId: newApp.id },
    });

    if (income) {
      const { id: _iid, borrowerId: _borid, updatedAt: _iat, ...incomeData } = income;
      await prisma.income.create({
        data: { ...incomeData, borrowerId: newBorrower.id },
      });
    }
  }

  // 5. Deep copy property
  if (source.property) {
    const { id: _pid, applicationId: _appId, updatedAt: _uat, ...propertyData } = source.property;
    await prisma.property.create({
      data: { ...propertyData, applicationId: newApp.id },
    });
  }

  // 6. Deep copy mortgageTerms (reset to DRAFT-compatible state)
  if (source.mortgageTerms) {
    const { id: _mid, applicationId: _appId, updatedAt: _uat, ...termsData } = source.mortgageTerms;
    await prisma.mortgageTerms.create({
      data: { ...termsData, applicationId: newApp.id, insured: false },
    });
  }

  // 7. Audit log
  logAction(tenantId, requesterId, newApp.id, 'APPLICATION_DUPLICATED', {
    sourceId: source.id,
    sourceFileNumber: source.fileNumber,
    newFileNumber,
  });

  // 8. Return full application
  const result = await prisma.application.findUniqueOrThrow({
    where: { id: newApp.id },
    include: APPLICATION_FULL_INCLUDE,
  });

  return result;
}
