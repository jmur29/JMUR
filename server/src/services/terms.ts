import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { calculateMonthlyPayment } from '../engine/underwrite';
import { logAction } from './audit';

export interface UpsertTermsInput {
  contractRate: number;
  amortizationYears: number;
  termYears: number;
  insured: boolean;
}

export async function upsertTerms(
  applicationId: string,
  input: UpsertTermsInput,
  tenantId: string,
  userId: string
) {
  // Verify application belongs to tenant and has a property to derive mortgage amount
  const application = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
    include: { property: true },
  });
  if (!application) return null;

  // Calculate derived fields
  const stressRate = Math.max(input.contractRate + 2, 5.25);

  let mortgageAmount = 0;
  let monthlyPayment = 0;

  if (application.property) {
    const pp = parseFloat(application.property.purchasePrice.toString());
    const dp = parseFloat(application.property.downPayment.toString());
    mortgageAmount = Math.max(pp - dp, 0);
    monthlyPayment = calculateMonthlyPayment(
      mortgageAmount,
      input.contractRate,
      input.amortizationYears
    );
  }

  const terms = await prisma.mortgageTerms.upsert({
    where: { applicationId },
    create: {
      applicationId,
      contractRate: new Prisma.Decimal(input.contractRate),
      stressRate: new Prisma.Decimal(stressRate),
      amortizationYears: input.amortizationYears,
      termYears: input.termYears,
      insured: input.insured,
      monthlyPayment: new Prisma.Decimal(monthlyPayment),
      mortgageAmount: new Prisma.Decimal(mortgageAmount),
    },
    update: {
      contractRate: new Prisma.Decimal(input.contractRate),
      stressRate: new Prisma.Decimal(stressRate),
      amortizationYears: input.amortizationYears,
      termYears: input.termYears,
      insured: input.insured,
      monthlyPayment: new Prisma.Decimal(monthlyPayment),
      mortgageAmount: new Prisma.Decimal(mortgageAmount),
    },
  });

  logAction(tenantId, userId, applicationId, 'TERMS_UPDATED', {
    contractRate: input.contractRate,
    stressRate,
    amortizationYears: input.amortizationYears,
  });

  return terms;
}

export async function getTermsByApplication(applicationId: string, tenantId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
  });
  if (!application) return null;

  return prisma.mortgageTerms.findUnique({ where: { applicationId } });
}
