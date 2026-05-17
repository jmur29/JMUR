import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { underwrite, UWResult } from '../engine/underwrite';
import type { IncomeInput, BorrowerInput, PropertyInput, TermsInput } from '../engine/underwrite';
import { logAction } from './audit';
import { sendDecisionEmail } from './email';
import { dispatchWebhook } from './webhooks';

// ─── Load and calculate ───────────────────────────────────────────────────────

export async function calculateUnderwriting(
  applicationId: string,
  tenantId: string
): Promise<{ result: UWResult } | { error: string }> {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
    include: {
      borrowers: { include: { income: true } },
      property: true,
      mortgageTerms: true,
    },
  });

  if (!application) {
    return { error: 'Application not found' };
  }

  const primary = application.borrowers.find((b) => b.type === 'PRIMARY');
  const coBorrower = application.borrowers.find((b) => b.type === 'CO_BORROWER');

  if (!primary) {
    return { error: 'Primary borrower not found' };
  }
  if (!primary.income) {
    return { error: 'Primary borrower income not found' };
  }
  if (!application.property) {
    return { error: 'Property details not found' };
  }
  if (!application.mortgageTerms) {
    return { error: 'Mortgage terms not found' };
  }

  const toNum = (d: Prisma.Decimal | null): number =>
    d ? parseFloat(d.toString()) : 0;

  const toNumOrNull = (d: Prisma.Decimal | null | undefined): number | null =>
    d != null ? parseFloat(d.toString()) : null;

  const primaryIncome = primary.income;

  const incomeInput: IncomeInput = {
    baseSalary: toNum(primaryIncome.baseSalary),
    bonus: toNum(primaryIncome.bonus),
    overtime: toNum(primaryIncome.overtime),
    otherIncome: toNum(primaryIncome.otherIncome),
    selfEmployedAvg: toNumOrNull(primaryIncome.selfEmployedAvg),
    rentalIncome: toNum(primaryIncome.rentalIncome),
    yearsEmployed: toNumOrNull(primaryIncome.yearsEmployed),
    employmentType: primary.employmentType as IncomeInput['employmentType'],
    ...(coBorrower && coBorrower.income
      ? {
          coIncome: {
            baseSalary: toNum(coBorrower.income.baseSalary),
            bonus: toNum(coBorrower.income.bonus),
            overtime: toNum(coBorrower.income.overtime),
            otherIncome: toNum(coBorrower.income.otherIncome),
            selfEmployedAvg: toNumOrNull(coBorrower.income.selfEmployedAvg),
            rentalIncome: toNum(coBorrower.income.rentalIncome),
            yearsEmployed: toNumOrNull(coBorrower.income.yearsEmployed),
            employmentType: coBorrower.employmentType,
          },
        }
      : {}),
  };

  const prop = application.property;
  const propertyInput: PropertyInput = {
    purchasePrice: toNum(prop.purchasePrice),
    appraisedValue: toNum(prop.appraisedValue),
    downPayment: toNum(prop.downPayment),
    annualTax: toNum(prop.annualTax),
    monthlyHeat: toNum(prop.monthlyHeat),
    condoFees: toNum(prop.condoFees),
  };

  const mt = application.mortgageTerms;
  const termsInput: TermsInput = {
    contractRate: toNum(mt.contractRate),
    amortizationYears: mt.amortizationYears,
    insured: mt.insured,
  };

  const borrowerInput: BorrowerInput = {
    creditScore: primary.creditScore,
    bankruptcies: primary.bankruptcies,
    collections: primary.collections,
    employmentType: primary.employmentType,
    existingMortgages: primary.existingMortgages,
    yearsEmployed: toNumOrNull(primary.income.yearsEmployed),
  };

  const result = underwrite(incomeInput, propertyInput, termsInput, borrowerInput);

  return { result };
}

// ─── Save decision ────────────────────────────────────────────────────────────

export async function saveDecision(
  applicationId: string,
  tenantId: string,
  userId: string,
  notes?: string
) {
  const calculated = await calculateUnderwriting(applicationId, tenantId);

  if ('error' in calculated) {
    return { error: calculated.error };
  }

  const { result } = calculated;

  // Map engine decision to ApplicationStatus
  const statusMap: Record<UWResult['decision'], 'APPROVED' | 'DECLINED' | 'CONDITIONALLY_APPROVED'> = {
    APPROVE: 'APPROVED',
    DECLINE: 'DECLINED',
    MANUAL_REVIEW: 'CONDITIONALLY_APPROVED',
  };

  const [decision] = await prisma.$transaction([
    prisma.underwritingDecision.create({
      data: {
        applicationId,
        gds: new Prisma.Decimal(result.gds),
        tds: new Prisma.Decimal(result.tds),
        ltv: new Prisma.Decimal(result.ltv),
        stressGds: new Prisma.Decimal(result.stressGds),
        stressTds: new Prisma.Decimal(result.stressTds),
        decision: result.decision,
        flags: result.flags as unknown as Prisma.JsonArray,
        notes: notes ?? null,
        decidedById: userId,
      },
      include: {
        decidedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.application.update({
      where: { id: applicationId },
      data: { status: statusMap[result.decision] },
    }),
  ]);

  logAction(tenantId, userId, applicationId, 'DECISION_SAVED', {
    decision: result.decision,
    gds: result.gds,
    tds: result.tds,
    ltv: result.ltv,
  });

  // Outbound webhook — dispatch decision event (fire-and-forget)
  const webhookEventMap: Record<UWResult['decision'], 'decision.approved' | 'decision.declined' | 'decision.manual_review'> = {
    APPROVE: 'decision.approved',
    DECLINE: 'decision.declined',
    MANUAL_REVIEW: 'decision.manual_review',
  };

  const appForWebhook = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { fileNumber: true },
  });

  if (appForWebhook) {
    dispatchWebhook({
      event: webhookEventMap[result.decision],
      tenantId,
      applicationId,
      fileNumber: appForWebhook.fileNumber,
      timestamp: new Date().toISOString(),
      data: {
        decision: result.decision,
        gds: result.gds,
        tds: result.tds,
        ltv: result.ltv,
        decisionId: decision.id,
      },
    }).catch(() => {/* already logged inside dispatchWebhook */});
  }

  // Send email notifications (fire-and-forget)
  const appBase = process.env.APP_URL ?? 'http://localhost:3000';
  const applicationUrl = `${appBase}/applications/${applicationId}`;

  // Fetch application with assignedTo user and primary borrower
  const appForEmail = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      assignedTo: { select: { email: true, firstName: true, lastName: true } },
      borrowers: { select: { type: true, firstName: true, lastName: true, email: true } },
    },
  });

  if (appForEmail) {
    const primary = appForEmail.borrowers.find((b) => b.type === 'PRIMARY');
    const borrowerName = primary ? `${primary.firstName} ${primary.lastName}` : 'Unknown Borrower';
    const decidedByName = `${decision.decidedBy.firstName} ${decision.decidedBy.lastName}`;
    const fileNumber = appForEmail.fileNumber;

    const emailPromises: Promise<void>[] = [];

    // Notify assigned underwriter
    if (appForEmail.assignedTo) {
      emailPromises.push(
        sendDecisionEmail({
          to: appForEmail.assignedTo.email,
          recipientName: `${appForEmail.assignedTo.firstName} ${appForEmail.assignedTo.lastName}`,
          fileNumber,
          borrowerName,
          decision: result.decision,
          decidedByName,
          notes: notes ?? null,
          applicationUrl,
          gds: result.gds,
          tds: result.tds,
          ltv: result.ltv,
        })
      );
    }

    // Notify primary borrower
    if (primary?.email) {
      emailPromises.push(
        sendDecisionEmail({
          to: primary.email,
          recipientName: `${primary.firstName} ${primary.lastName}`,
          fileNumber,
          borrowerName,
          decision: result.decision,
          decidedByName,
          notes: notes ?? null,
          applicationUrl,
          gds: result.gds,
          tds: result.tds,
          ltv: result.ltv,
        })
      );
    }

    Promise.all(emailPromises).catch(() => {/* swallow — already logged inside sendDecisionEmail */});
  }

  return { decision, result };
}

export async function getDecisionsByApplication(applicationId: string, tenantId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
  });
  if (!application) return null;

  return prisma.underwritingDecision.findMany({
    where: { applicationId },
    orderBy: { decidedAt: 'desc' },
    include: {
      decidedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}
