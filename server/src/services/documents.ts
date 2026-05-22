import {
  S3Client,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { DocumentStatus, DocumentType } from '@prisma/client';
import prisma from '../prisma/client';
import { logAction } from './audit';

// ─── S3 client ────────────────────────────────────────────────────────────────

export const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? 'ca-central-1',
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

export const S3_BUCKET = process.env.AWS_S3_BUCKET ?? '';

// ─── Service functions ────────────────────────────────────────────────────────

export async function createDocumentRecord(
  applicationId: string,
  uploadedById: string,
  tenantId: string,
  name: string,
  type: DocumentType,
  s3Key: string,
  url: string
) {
  // Verify application belongs to tenant
  const application = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
  });
  if (!application) return null;

  const doc = await prisma.document.create({
    data: {
      applicationId,
      uploadedById,
      name,
      type,
      s3Key,
      url,
      status: 'PENDING',
    },
  });

  logAction(tenantId, uploadedById, applicationId, 'DOCUMENT_UPLOADED', {
    documentId: doc.id,
    name,
    type,
  });

  return doc;
}

export async function listDocuments(applicationId: string, tenantId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
  });
  if (!application) return null;

  return prisma.document.findMany({
    where: { applicationId },
    orderBy: { uploadedAt: 'desc' },
    include: {
      uploadedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function updateDocumentStatus(
  documentId: string,
  applicationId: string,
  tenantId: string,
  userId: string,
  status: DocumentStatus
) {
  // Verify the document's application belongs to tenant
  const doc = await prisma.document.findFirst({
    where: { id: documentId, applicationId },
    include: { application: { select: { tenantId: true } } },
  });

  if (!doc || doc.application.tenantId !== tenantId) return null;

  const updated = await prisma.document.update({
    where: { id: documentId },
    data: { status },
  });

  logAction(tenantId, userId, applicationId, 'DOCUMENT_STATUS_UPDATED', {
    documentId,
    status,
  });

  return updated;
}

export async function deleteDocument(
  documentId: string,
  applicationId: string,
  tenantId: string,
  userId: string
) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, applicationId },
    include: { application: { select: { tenantId: true } } },
  });

  if (!doc || doc.application.tenantId !== tenantId) return null;

  // Delete from S3
  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: doc.s3Key })
    );
  } catch {
    // Log but don't block DB deletion
  }

  await prisma.document.delete({ where: { id: documentId } });

  logAction(tenantId, userId, applicationId, 'DOCUMENT_DELETED', { documentId, name: doc.name });

  return doc;
}

export async function getPresignedDownloadUrl(
  documentId: string,
  applicationId: string,
  tenantId: string
): Promise<string | null> {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, applicationId },
    include: { application: { select: { tenantId: true } } },
  });

  if (!doc || doc.application.tenantId !== tenantId) return null;

  const url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: doc.s3Key }),
    { expiresIn: 900 } // 15 minutes
  );

  return url;
}
