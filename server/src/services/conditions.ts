import prisma from '../prisma/client';
import { logAction } from './audit';

const CONDITION_INCLUDE = {
  clearedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

// ─── List conditions ──────────────────────────────────────────────────────────

export async function listConditions(applicationId: string, tenantId: string) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!app) return null;

  return prisma.approvalCondition.findMany({
    where: { applicationId },
    include: CONDITION_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });
}

// ─── Create condition ─────────────────────────────────────────────────────────

export async function createCondition(
  applicationId: string,
  body: string,
  tenantId: string,
  userId: string
) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!app) return null;

  const condition = await prisma.approvalCondition.create({
    data: { applicationId, body },
    include: CONDITION_INCLUDE,
  });

  logAction(tenantId, userId, applicationId, 'CONDITION_CREATED', { conditionId: condition.id });

  return condition;
}

// ─── Update condition ─────────────────────────────────────────────────────────

export async function updateCondition(
  conditionId: string,
  tenantId: string,
  userId: string,
  data: { body?: string; cleared?: boolean; clearedById?: string }
) {
  // Verify it belongs to this tenant via application
  const existing = await prisma.approvalCondition.findUnique({
    where: { id: conditionId },
    include: { application: { select: { tenantId: true } } },
  });

  if (!existing || existing.application.tenantId !== tenantId) return null;

  const updateData: {
    body?: string;
    cleared?: boolean;
    clearedById?: string | null;
    clearedAt?: Date | null;
  } = {};

  if (data.body !== undefined) updateData.body = data.body;

  if (data.cleared !== undefined) {
    updateData.cleared = data.cleared;
    if (data.cleared) {
      updateData.clearedById = data.clearedById ?? userId;
      updateData.clearedAt = new Date();
    } else {
      updateData.clearedById = null;
      updateData.clearedAt = null;
    }
  }

  const updated = await prisma.approvalCondition.update({
    where: { id: conditionId },
    data: updateData,
    include: CONDITION_INCLUDE,
  });

  logAction(tenantId, userId, existing.applicationId, 'CONDITION_UPDATED', {
    conditionId,
    changes: data as Record<string, unknown>,
  });

  return updated;
}

// ─── Delete condition ─────────────────────────────────────────────────────────

export async function deleteCondition(
  conditionId: string,
  tenantId: string,
  userId: string
) {
  const existing = await prisma.approvalCondition.findUnique({
    where: { id: conditionId },
    include: { application: { select: { tenantId: true, id: true } } },
  });

  if (!existing || existing.application.tenantId !== tenantId) return null;

  await prisma.approvalCondition.delete({ where: { id: conditionId } });

  logAction(tenantId, userId, existing.applicationId, 'CONDITION_DELETED', { conditionId });

  return { deleted: true } as const;
}
