import { Request, Response, NextFunction } from 'express';
import { parseSubmissionNote, analyzeDeal } from '../services/ai';
import { underwrite } from '../engine/underwrite';
import prisma from '../prisma/client';

export async function parseSubmission(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { text } = req.body as { text: string };
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'text is required', code: 'BAD_REQUEST' });
      return;
    }
    const parsed = await parseSubmissionNote(text);
    res.json(parsed);
  } catch (err) {
    next(err);
  }
}

export async function reviewFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { applicationId } = req.body as { applicationId: string };
    if (!applicationId || typeof applicationId !== 'string') {
      res.status(400).json({ error: 'applicationId is required', code: 'BAD_REQUEST' });
      return;
    }

    const application = await prisma.application.findFirst({
      where: { id: applicationId, tenantId: req.user.tenantId, deletedAt: null },
      include: {
        borrowers: { include: { income: true } },
        property: true,
        mortgageTerms: true,
        decisions: { orderBy: { decidedAt: 'desc' }, take: 1 },
      },
    });

    if (!application) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }

    // Compute ratios to give AI richer context
    let computedRatios: Record<string, number> | null = null;
    const primary = application.borrowers.find((b) => b.type === 'PRIMARY');
    const co = application.borrowers.find((b) => b.type === 'CO_BORROWER');

    if (primary?.income && application.property && application.mortgageTerms) {
      const p = primary.income;
      const prop = application.property;
      const terms = application.mortgageTerms;

      const coIncome = co?.income
        ? {
            baseSalary: Number(co.income.baseSalary),
            bonus: Number(co.income.bonus),
            overtime: Number(co.income.overtime),
            otherIncome: Number(co.income.otherIncome),
            selfEmployedAvg: co.income.selfEmployedAvg ? Number(co.income.selfEmployedAvg) : null,
            rentalIncome: Number(co.income.rentalIncome),
            yearsEmployed: co.income.yearsEmployed ? Number(co.income.yearsEmployed) : null,
            employmentType: co.employmentType,
          }
        : undefined;

      try {
        const uwResult = underwrite(
          {
            baseSalary: Number(p.baseSalary),
            bonus: Number(p.bonus),
            overtime: Number(p.overtime),
            otherIncome: Number(p.otherIncome),
            selfEmployedAvg: p.selfEmployedAvg ? Number(p.selfEmployedAvg) : null,
            rentalIncome: Number(p.rentalIncome),
            yearsEmployed: p.yearsEmployed ? Number(p.yearsEmployed) : null,
            employmentType: primary.employmentType,
            coIncome,
          },
          {
            purchasePrice: Number(prop.purchasePrice),
            appraisedValue: Number(prop.appraisedValue),
            downPayment: Number(prop.downPayment),
            annualTax: Number(prop.annualTax),
            monthlyHeat: Number(prop.monthlyHeat),
            condoFees: Number(prop.condoFees),
          },
          {
            contractRate: Number(terms.contractRate),
            amortizationYears: terms.amortizationYears,
            insured: terms.insured,
          },
          {
            creditScore: primary.creditScore,
            bankruptcies: primary.bankruptcies,
            collections: primary.collections,
            employmentType: primary.employmentType,
            existingMortgages: primary.existingMortgages,
            yearsEmployed: primary.income?.yearsEmployed ? Number(primary.income.yearsEmployed) : null,
          }
        );

        computedRatios = {
          gds: uwResult.gds,
          tds: uwResult.tds,
          ltv: uwResult.ltv,
          stressGds: uwResult.stressGds,
          stressTds: uwResult.stressTds,
          mortgageAmount: uwResult.mortgageAmount,
          monthlyPayment: uwResult.monthlyPayment,
          stressPayment: uwResult.stressPayment,
          stressRate: uwResult.stressRate,
          monthlyQualifyingIncome: uwResult.monthlyIncome,
        };
      } catch {
        // Ratio computation is best-effort — proceed without it
      }
    }

    const intelligence = await analyzeDeal({ ...application, computedRatios });

    // Persist result so it loads instantly on next view
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        dealIntelligence: intelligence as object,
        dealAnalyzedAt: new Date(),
      },
    });

    res.json(intelligence);
  } catch (err) {
    next(err);
  }
}
