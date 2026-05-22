import prisma from '../prisma/client';
import { encryptSIN } from '../utils/crypto';
import { logAction } from './audit';
import type { EmploymentType, BorrowerType } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateBorrowerInput {
  applicationId: string;
  type: BorrowerType;
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  phone: string;
  sin: string;
  employmentType: EmploymentType;
  creditScore: number;
  bankruptcies: boolean;
  collections: boolean;
  existingMortgages: number;
}

export interface UpdateBorrowerInput {
  firstName?: string;
  lastName?: string;
  dob?: string;
  email?: string;
  phone?: string;
  sin?: string;
  employmentType?: EmploymentType;
  creditScore?: number;
  bankruptcies?: boolean;
  collections?: boolean;
  existingMortgages?: number;
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function createBorrower(
  input: CreateBorrowerInput,
  tenantId: string,
  userId: string
) {
  // Verify applicationId belongs to this tenant
  const application = await prisma.application.findFirst({
    where: { id: input.applicationId, tenantId, deletedAt: null },
  });
  if (!application) {
    const err = new Error('Application not found') as Error & { statusCode: number; code: string };
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const sinEncrypted = encryptSIN(input.sin);

  const borrower = await prisma.borrower.create({
    data: {
      applicationId: input.applicationId,
      type: input.type,
      firstName: input.firstName,
      lastName: input.lastName,
      dob: new Date(input.dob),
      email: input.email,
      phone: input.phone,
      sinEncrypted,
      employmentType: input.employmentType,
      creditScore: input.creditScore,
      bankruptcies: input.bankruptcies,
      collections: input.collections,
      existingMortgages: input.existingMortgages,
    },
    include: { income: true },
  });

  logAction(tenantId, userId, input.applicationId, 'BORROWER_CREATED', {
    borrowerId: borrower.id,
    type: input.type,
    name: `${input.firstName} ${input.lastName}`,
  });

  return borrower;
}

export async function getBorrowersByApplication(
  applicationId: string,
  tenantId: string
) {
  // Verify application belongs to tenant
  const application = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
  });
  if (!application) return null;

  return prisma.borrower.findMany({
    where: { applicationId },
    include: { income: true },
  });
}

export async function updateBorrower(
  borrowerId: string,
  input: UpdateBorrowerInput,
  tenantId: string,
  userId: string
) {
  // Verify the borrower's application belongs to this tenant
  const borrower = await prisma.borrower.findFirst({
    where: { id: borrowerId },
    include: { application: true },
  });

  if (!borrower || borrower.application.tenantId !== tenantId) {
    return null;
  }

  const sinEncrypted = input.sin ? encryptSIN(input.sin) : undefined;

  const updated = await prisma.borrower.update({
    where: { id: borrowerId },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.dob !== undefined ? { dob: new Date(input.dob) } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(sinEncrypted !== undefined ? { sinEncrypted } : {}),
      ...(input.employmentType !== undefined ? { employmentType: input.employmentType } : {}),
      ...(input.creditScore !== undefined ? { creditScore: input.creditScore } : {}),
      ...(input.bankruptcies !== undefined ? { bankruptcies: input.bankruptcies } : {}),
      ...(input.collections !== undefined ? { collections: input.collections } : {}),
      ...(input.existingMortgages !== undefined
        ? { existingMortgages: input.existingMortgages }
        : {}),
    },
    include: { income: true },
  });

  logAction(tenantId, userId, borrower.applicationId, 'BORROWER_UPDATED', {
    borrowerId,
  });

  return updated;
}

export async function deleteBorrower(
  borrowerId: string,
  tenantId: string,
  userId: string
) {
  const borrower = await prisma.borrower.findFirst({
    where: { id: borrowerId },
    include: { application: true },
  });

  if (!borrower || borrower.application.tenantId !== tenantId) {
    return null;
  }

  // Hard delete — borrowers don't have their own deletedAt
  const deleted = await prisma.borrower.delete({ where: { id: borrowerId } });

  logAction(tenantId, userId, borrower.applicationId, 'BORROWER_DELETED', { borrowerId });

  return deleted;
}
