import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { logAction } from './audit';

export interface UpsertIncomeInput {
  employerName?: string | null;
  jobTitle?: string | null;
  yearsEmployed?: number | null;
  baseSalary?: number;
  bonus?: number;
  overtime?: number;
  otherIncome?: number;
  selfEmployedAvg?: number | null;
  rentalIncome?: number;
}

export async function upsertIncome(
  borrowerId: string,
  input: UpsertIncomeInput,
  tenantId: string,
  userId: string
) {
  // Verify borrower's application belongs to this tenant
  const borrower = await prisma.borrower.findFirst({
    where: { id: borrowerId },
    include: { application: { select: { tenantId: true, id: true } } },
  });

  if (!borrower || borrower.application.tenantId !== tenantId) {
    return null;
  }

  const toDecimalOrNull = (v: number | null | undefined): Prisma.Decimal | undefined => {
    if (v === undefined) return undefined;
    if (v === null) return undefined;
    return new Prisma.Decimal(v);
  };

  const data = {
    employerName: input.employerName,
    jobTitle: input.jobTitle,
    yearsEmployed:
      input.yearsEmployed !== undefined
        ? input.yearsEmployed !== null
          ? new Prisma.Decimal(input.yearsEmployed)
          : null
        : undefined,
    baseSalary: toDecimalOrNull(input.baseSalary),
    bonus: toDecimalOrNull(input.bonus),
    overtime: toDecimalOrNull(input.overtime),
    otherIncome: toDecimalOrNull(input.otherIncome),
    selfEmployedAvg:
      input.selfEmployedAvg !== undefined
        ? input.selfEmployedAvg !== null
          ? new Prisma.Decimal(input.selfEmployedAvg)
          : null
        : undefined,
    rentalIncome: toDecimalOrNull(input.rentalIncome),
  };

  // Remove undefined values
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );

  const income = await prisma.income.upsert({
    where: { borrowerId },
    create: {
      borrowerId,
      ...cleanData,
    } as Parameters<typeof prisma.income.create>[0]['data'],
    update: cleanData as Parameters<typeof prisma.income.update>[0]['data'],
  });

  logAction(tenantId, userId, borrower.application.id, 'INCOME_UPDATED', { borrowerId });

  return income;
}

export async function getIncomeByBorrower(borrowerId: string, tenantId: string) {
  const borrower = await prisma.borrower.findFirst({
    where: { id: borrowerId },
    include: { application: { select: { tenantId: true } } },
  });

  if (!borrower || borrower.application.tenantId !== tenantId) {
    return null;
  }

  return prisma.income.findUnique({ where: { borrowerId } });
}
