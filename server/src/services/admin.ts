import { UserRole, Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { logAction } from './audit';

// ─── User management ──────────────────────────────────────────────────────────

export async function listUsers(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      clerkId: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
}

export async function updateUserRole(
  targetUserId: string,
  tenantId: string,
  requestingUserId: string,
  role: UserRole
) {
  const user = await prisma.user.findFirst({
    where: { id: targetUserId, tenantId, deletedAt: null },
  });
  if (!user) return null;

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { role },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  });

  logAction(tenantId, requestingUserId, null, 'USER_ROLE_UPDATED', {
    targetUserId,
    newRole: role,
    previousRole: user.role,
  });

  return updated;
}

// ─── Pipeline statistics ──────────────────────────────────────────────────────

export interface PipelineStats {
  totalApplications: number;
  byStatus: Record<string, number>;
  approvedThisMonth: number;
  avgGds: number | null;
  avgTds: number | null;
  avgLtv: number | null;
  approvalRate: number | null;
  totalDecisions: number;
}

export async function getPipelineStats(tenantId: string): Promise<PipelineStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Total apps and breakdown by status
  const [statusGroups, approvedThisMonth, decisionAggregates, totalDecisions] =
    await Promise.all([
      prisma.application.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: { id: true },
      }),
      prisma.application.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'APPROVED',
          updatedAt: { gte: startOfMonth },
        },
      }),
      prisma.underwritingDecision.aggregate({
        where: { application: { tenantId } },
        _avg: {
          gds: true,
          tds: true,
          ltv: true,
        },
      }),
      prisma.underwritingDecision.count({
        where: { application: { tenantId } },
      }),
    ]);

  const totalApplications = statusGroups.reduce((sum, g) => sum + g._count.id, 0);

  const byStatus: Record<string, number> = {};
  for (const g of statusGroups) {
    byStatus[g.status] = g._count.id;
  }

  // Approval rate = APPROVED / (APPROVED + DECLINED) from decisions
  const [approveCount, declineCount] = await Promise.all([
    prisma.underwritingDecision.count({
      where: { application: { tenantId }, decision: 'APPROVE' },
    }),
    prisma.underwritingDecision.count({
      where: { application: { tenantId }, decision: 'DECLINE' },
    }),
  ]);

  const denominator = approveCount + declineCount;
  const approvalRate =
    denominator > 0
      ? parseFloat(((approveCount / denominator) * 100).toFixed(1))
      : null;

  const toAvgNum = (d: Prisma.Decimal | null): number | null =>
    d ? parseFloat(parseFloat(d.toString()).toFixed(3)) : null;

  return {
    totalApplications,
    byStatus,
    approvedThisMonth,
    avgGds: toAvgNum(decisionAggregates._avg.gds),
    avgTds: toAvgNum(decisionAggregates._avg.tds),
    avgLtv: toAvgNum(decisionAggregates._avg.ltv),
    approvalRate,
    totalDecisions,
  };
}
