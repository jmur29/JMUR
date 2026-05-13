import { UserRole, Prisma } from '@prisma/client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import prisma from '../prisma/client';
import { logAction } from './audit';
import { s3Client, S3_BUCKET } from './documents';

// ─── Audit log viewer ─────────────────────────────────────────────────────────

export interface AuditLogWithUser {
  id: string;
  tenantId: string;
  userId: string;
  applicationId: string | null;
  action: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export async function listAuditLogs(
  tenantId: string,
  filters: {
    applicationId?: string;
    userId?: string;
    action?: string;
    page: number;
    pageSize: number;
  }
): Promise<{ data: AuditLogWithUser[]; total: number }> {
  const where: Prisma.AuditLogWhereInput = {
    tenantId,
    ...(filters.applicationId ? { applicationId: filters.applicationId } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.action ? { action: { contains: filters.action, mode: 'insensitive' as const } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data: data as AuditLogWithUser[], total };
}

// ─── Tenant management ────────────────────────────────────────────────────────

export async function getTenant(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true, createdAt: true },
  });
}

export async function updateTenant(
  tenantId: string,
  data: { name?: string; primaryColor?: string; logoUrl?: string }
) {
  return prisma.tenant.update({
    where: { id: tenantId },
    data,
    select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true, createdAt: true },
  });
}

export async function uploadTenantLogo(
  tenantId: string,
  userId: string,
  buffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<{ logoUrl: string }> {
  const ext = originalName.split('.').pop() ?? 'png';
  const s3Key = `tenants/${tenantId}/logo.${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000',
    })
  );

  const logoUrl = `https://${S3_BUCKET}.s3.amazonaws.com/${s3Key}`;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { logoUrl },
  });

  logAction(tenantId, userId, null, 'TENANT_LOGO_UPDATED', { s3Key });

  return { logoUrl };
}

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
