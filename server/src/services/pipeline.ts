import { Prisma } from '@prisma/client';
import { extractTextFromS3, extractTablesFromBankStatement } from '../ocr';
import {
  classifyDocument,
  sourceDownPayment,
  draftLOE,
  generateCreditMemoNarrative,
  draftSubmissionNotes,
  explainFraudSignal,
} from '../ai';
import {
  checkPDFMetadata,
  checkBalanceIntegrity,
  checkEmployerConsistency,
  checkRoundNumberDeposits,
  type FraudSignalResult,
} from '../fraud';
import { underwrite, type IncomeInput, type PropertyInput, type TermsInput, type BorrowerInput } from '../engine/underwrite';
import { s3Client } from './documents';
import { logAction } from './audit';
import { recordStatusChange } from './statusHistory';
import prisma from '../prisma/client';
import logger from '../utils/logger';

// ─── Pipeline status tracking (in-memory for MVP) ────────────────────────────

export interface PipelineStatus {
  applicationId: string;
  stage:
    | 'PENDING'
    | 'OCR'
    | 'CLASSIFYING'
    | 'SOURCING_DOWN_PAYMENT'
    | 'FRAUD_CHECK'
    | 'GENERATING_CREDIT_MEMO'
    | 'COMPLETE'
    | 'ERROR';
  progress: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export const pipelineStatus = new Map<string, PipelineStatus>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function updateStatus(
  applicationId: string,
  stage: PipelineStatus['stage'],
  progress: number,
  extra?: Partial<PipelineStatus>,
): void {
  const current = pipelineStatus.get(applicationId);
  pipelineStatus.set(applicationId, {
    applicationId,
    stage,
    progress,
    startedAt: current?.startedAt ?? new Date().toISOString(),
    ...extra,
  });
}

const toNum = (d: Prisma.Decimal | null | undefined): number =>
  d ? parseFloat(d.toString()) : 0;

const toNumOrNull = (d: Prisma.Decimal | null | undefined): number | null =>
  d != null ? parseFloat(d.toString()) : null;

async function saveFraudSignal(
  signal: FraudSignalResult,
  documentId: string,
  tenantId: string,
  documentName: string,
): Promise<void> {
  try {
    // Get AI explanation
    let aiExplanation: string | null = null;
    try {
      aiExplanation = await explainFraudSignal({
        signalType: signal.signalType,
        evidence: signal.evidence,
        documentName,
      });
    } catch (err) {
      logger.warn('Failed to get AI explanation for fraud signal', {
        signalType: signal.signalType,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await prisma.fraudSignal.create({
      data: {
        tenantId,
        documentId,
        signalType: signal.signalType,
        severity: signal.severity,
        evidence: signal.evidence,
        recommendedAction: signal.recommendedAction,
        aiExplanation,
      },
    });
  } catch (err) {
    logger.error('Failed to save FraudSignal', {
      documentId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function processApplication(
  applicationId: string,
  tenantId: string,
  userId: string,
): Promise<void> {
  updateStatus(applicationId, 'PENDING', 0);

  logger.info('Pipeline started', { applicationId, tenantId });

  // ── Step 1: Fetch application with all related data ───────────────────────
  const application = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
    include: {
      documents: true,
      borrowers: { include: { income: true } },
      property: true,
      mortgageTerms: true,
      createdBy: { select: { id: true, role: true } },
    },
  });

  if (!application) {
    updateStatus(applicationId, 'ERROR', 0, { error: 'Application not found', completedAt: new Date().toISOString() });
    return;
  }

  const primary = application.borrowers.find((b) => b.type === 'PRIMARY');
  const coBorrower = application.borrowers.find((b) => b.type === 'CO_BORROWER');

  const monthlyIncome = primary?.income
    ? (toNum(primary.income.baseSalary) +
        toNum(primary.income.bonus) +
        toNum(primary.income.overtime) +
        toNum(primary.income.otherIncome) +
        toNum(primary.income.rentalIncome) * 0.5 +
        (toNumOrNull(primary.income.selfEmployedAvg) ?? 0)) /
      12
    : null;

  // ── Step 2: OCR all documents ─────────────────────────────────────────────
  updateStatus(applicationId, 'OCR', 10);

  interface DocumentOcrResult {
    doc: typeof application.documents[0];
    ocrText: string;
  }
  const ocrResults: DocumentOcrResult[] = [];

  for (const doc of application.documents) {
    try {
      const ocrText = await extractTextFromS3(doc.s3Key);
      ocrResults.push({ doc, ocrText });
    } catch (err) {
      logger.warn('OCR failed for document', {
        documentId: doc.id,
        error: err instanceof Error ? err.message : String(err),
      });
      ocrResults.push({ doc, ocrText: '' });
    }
  }

  // ── Step 3: Classify documents ────────────────────────────────────────────
  updateStatus(applicationId, 'CLASSIFYING', 25);

  interface ClassifiedDoc {
    doc: typeof application.documents[0];
    classifiedType: string;
    extractedFields: Record<string, unknown>;
    ocrText: string;
  }
  const classifiedDocs: ClassifiedDoc[] = [];

  for (const { doc, ocrText } of ocrResults) {
    try {
      if (!ocrText) {
        classifiedDocs.push({ doc, classifiedType: doc.type, extractedFields: {}, ocrText });
        continue;
      }

      const classification = await classifyDocument(ocrText, tenantId, doc.id, userId);

      await prisma.documentClassification.upsert({
        where: { documentId: doc.id },
        create: {
          tenantId,
          documentId: doc.id,
          classifiedType: classification.classifiedType,
          confidence: classification.confidence,
          extractedFields: classification.extractedFields as Prisma.InputJsonObject,
          rawOcrText: ocrText,
        },
        update: {
          classifiedType: classification.classifiedType,
          confidence: classification.confidence,
          extractedFields: classification.extractedFields as Prisma.InputJsonObject,
          rawOcrText: ocrText,
        },
      });

      classifiedDocs.push({
        doc,
        classifiedType: classification.classifiedType,
        extractedFields: classification.extractedFields,
        ocrText,
      });
    } catch (err) {
      logger.warn('Document classification failed', {
        documentId: doc.id,
        error: err instanceof Error ? err.message : String(err),
      });
      classifiedDocs.push({ doc, classifiedType: doc.type, extractedFields: {}, ocrText });
    }
  }

  // ── Step 4: Fraud checks (PDF metadata, round numbers) ────────────────────
  updateStatus(applicationId, 'FRAUD_CHECK', 40);

  for (const { doc } of classifiedDocs) {
    // PDF metadata check
    if (doc.s3Key.toLowerCase().endsWith('.pdf') || doc.name.toLowerCase().endsWith('.pdf')) {
      try {
        const metaSignal = await checkPDFMetadata(doc.s3Key, s3Client);
        if (metaSignal) {
          await saveFraudSignal(metaSignal, doc.id, tenantId, doc.name);
        }
      } catch (err) {
        logger.warn('PDF metadata check failed', {
          documentId: doc.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // ── Step 5: Bank statement processing ─────────────────────────────────────
  updateStatus(applicationId, 'SOURCING_DOWN_PAYMENT', 55);

  // Collect employer names for employer consistency check
  const payStubEmployers: string[] = [];
  const t4Employers: string[] = [];

  for (const { doc, classifiedType, extractedFields } of classifiedDocs) {
    // Collect employers
    if (classifiedType === 'PAY_STUB' && extractedFields.employer) {
      payStubEmployers.push(String(extractedFields.employer));
    }
    if ((classifiedType === 'T4' || classifiedType === 'NOA') && extractedFields.employer) {
      t4Employers.push(String(extractedFields.employer));
    }

    if (classifiedType !== 'BANK_STATEMENT') continue;

    // Extract tables
    let transactions: Awaited<ReturnType<typeof extractTablesFromBankStatement>> = [];
    try {
      transactions = await extractTablesFromBankStatement(doc.s3Key);
    } catch (err) {
      logger.warn('Table extraction failed for bank statement', {
        documentId: doc.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Balance integrity check
    if (transactions.length > 0) {
      try {
        const balanceSignal = checkBalanceIntegrity(transactions);
        if (balanceSignal) {
          await saveFraudSignal(balanceSignal, doc.id, tenantId, doc.name);
        }
      } catch (err) {
        logger.warn('Balance integrity check failed', {
          documentId: doc.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Round number deposits
      try {
        const roundSignals = checkRoundNumberDeposits(transactions);
        for (const signal of roundSignals) {
          await saveFraudSignal(signal, doc.id, tenantId, doc.name);
        }
      } catch (err) {
        logger.warn('Round number check failed', {
          documentId: doc.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Source down payment
      if (transactions.length > 0) {
        try {
          const sourced = await sourceDownPayment(
            transactions,
            monthlyIncome,
            tenantId,
            applicationId,
            userId,
          );

          // Clear existing entries for this application first (re-run support)
          await prisma.downPaymentEntry.deleteMany({
            where: { applicationId, tenantId },
          });

          // Save entries
          for (const entry of sourced.entries) {
            if (!entry.transactionDate) continue;
            const saved = await prisma.downPaymentEntry.create({
              data: {
                tenantId,
                applicationId,
                transactionDate: new Date(entry.transactionDate),
                description: entry.description,
                amount: new Prisma.Decimal(entry.amount),
                runningBalance: entry.runningBalance !== null ? new Prisma.Decimal(entry.runningBalance) : null,
                category: entry.category,
                isFlagged: entry.isFlagged,
                flagReason: entry.flagReason,
                loeRequired: entry.loeRequired,
              },
            });

            // Draft LOE for flagged entries requiring one
            if (entry.loeRequired && entry.isFlagged) {
              try {
                const borrowerName = primary
                  ? `${primary.firstName} ${primary.lastName}`
                  : 'Borrower';

                const loeDraft = await draftLOE(
                  {
                    transactionDate: new Date(entry.transactionDate),
                    description: entry.description,
                    amount: entry.amount,
                    flagReason: entry.flagReason,
                  },
                  borrowerName,
                );

                await prisma.downPaymentEntry.update({
                  where: { id: saved.id },
                  data: { loeDraftText: loeDraft },
                });
              } catch (err) {
                logger.warn('LOE draft failed for entry', {
                  entryId: saved.id,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }
          }
        } catch (err) {
          logger.warn('Down payment sourcing failed', {
            documentId: doc.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  // ── Step 6: Employer consistency check ────────────────────────────────────
  if (payStubEmployers.length > 0 && t4Employers.length > 0) {
    // Check first pay stub against first T4 employer
    for (const psEmployer of payStubEmployers) {
      for (const t4Employer of t4Employers) {
        try {
          const empSignal = checkEmployerConsistency(psEmployer, t4Employer);
          if (empSignal) {
            // Associate with first pay stub document
            const payStubDoc = classifiedDocs.find((d) => d.classifiedType === 'PAY_STUB');
            if (payStubDoc) {
              await saveFraudSignal(empSignal, payStubDoc.doc.id, tenantId, payStubDoc.doc.name);
            }
          }
        } catch (err) {
          logger.warn('Employer consistency check failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  // ── Step 7: Run underwriting engine ──────────────────────────────────────
  updateStatus(applicationId, 'GENERATING_CREDIT_MEMO', 70);

  let uwResult: ReturnType<typeof underwrite> | null = null;

  if (primary && primary.income && application.property && application.mortgageTerms) {
    try {
      const prop = application.property;
      const mt = application.mortgageTerms;
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

      const propertyInput: PropertyInput = {
        purchasePrice: toNum(prop.purchasePrice),
        appraisedValue: toNum(prop.appraisedValue),
        downPayment: toNum(prop.downPayment),
        annualTax: toNum(prop.annualTax),
        monthlyHeat: toNum(prop.monthlyHeat),
        condoFees: toNum(prop.condoFees),
      };

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
        yearsEmployed: toNumOrNull(primaryIncome.yearsEmployed),
      };

      uwResult = underwrite(incomeInput, propertyInput, termsInput, borrowerInput);
    } catch (err) {
      logger.warn('Underwriting calculation failed in pipeline', {
        applicationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Step 8: Generate credit memo ──────────────────────────────────────────
  if (uwResult && primary && application.property) {
    try {
      const fraudSignalCount = await prisma.fraudSignal.count({
        where: { tenantId, document: { applicationId } },
      });

      const downPaymentEntries = await prisma.downPaymentEntry.findMany({
        where: { applicationId, tenantId },
      });

      const flaggedCount = downPaymentEntries.filter((e) => e.isFlagged).length;
      const downPaymentSourced = flaggedCount === 0 || downPaymentEntries.length === 0;

      const conditions = await prisma.approvalCondition.findMany({
        where: { applicationId },
        select: { body: true },
      });

      const prop = application.property;
      const propertyStr = `${prop.address}, ${prop.city}, ${prop.province}`;
      const borrowerName = `${primary.firstName} ${primary.lastName}`;

      const narrative = await generateCreditMemoNarrative({
        borrowerName,
        property: propertyStr,
        purchasePrice: toNum(prop.purchasePrice),
        downPayment: toNum(prop.downPayment),
        mortgageAmount: uwResult.mortgageAmount,
        gds: uwResult.gds,
        tds: uwResult.tds,
        ltv: uwResult.ltv,
        stressGds: uwResult.stressGds,
        stressTds: uwResult.stressTds,
        decision: uwResult.decision,
        flags: uwResult.flags,
        fraudSignalCount,
        downPaymentSourced,
        conditions: conditions.map((c) => c.body),
      });

      await prisma.creditMemo.upsert({
        where: { applicationId },
        create: {
          tenantId,
          applicationId,
          gds: new Prisma.Decimal(uwResult.gds),
          tds: new Prisma.Decimal(uwResult.tds),
          qualifyingRate: new Prisma.Decimal(uwResult.stressRate),
          downPaymentTotal: new Prisma.Decimal(toNum(prop.downPayment)),
          downPaymentSourced,
          flagCount: uwResult.flags.filter((f) => f.type === 'WARN' || f.type === 'FAIL').length,
          fraudSignalCount,
          narrative,
          aiModel: 'claude-sonnet-4-20250514',
        },
        update: {
          gds: new Prisma.Decimal(uwResult.gds),
          tds: new Prisma.Decimal(uwResult.tds),
          qualifyingRate: new Prisma.Decimal(uwResult.stressRate),
          downPaymentTotal: new Prisma.Decimal(toNum(prop.downPayment)),
          downPaymentSourced,
          flagCount: uwResult.flags.filter((f) => f.type === 'WARN' || f.type === 'FAIL').length,
          fraudSignalCount,
          narrative,
          generatedAt: new Date(),
          aiModel: 'claude-sonnet-4-20250514',
        },
      });
    } catch (err) {
      logger.warn('Credit memo generation failed', {
        applicationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Step 9: Draft submission notes for BROKER role ────────────────────────
  const creatorRole = application.createdBy?.role;
  if (creatorRole === 'BROKER' && uwResult && primary && application.property) {
    try {
      const prop = application.property;
      const borrowerName = `${primary.firstName} ${primary.lastName}`;
      const propertyStr = `${prop.address}, ${prop.city}, ${prop.province}`;
      const lenderTarget = application.lenderTarget ?? 'General Lender';

      const submissionResult = await draftSubmissionNotes(
        {
          borrowerName,
          property: propertyStr,
          purchasePrice: toNum(prop.purchasePrice),
          downPayment: toNum(prop.downPayment),
          gds: uwResult.gds,
          tds: uwResult.tds,
          ltv: uwResult.ltv,
          employmentType: primary.employmentType,
          creditScore: primary.creditScore,
          flags: uwResult.flags,
          lenderTarget,
        },
        tenantId,
        applicationId,
        userId,
      );

      await prisma.submissionNote.upsert({
        where: { applicationId },
        create: {
          tenantId,
          applicationId,
          draftText: submissionResult.draftText,
          lenderTarget,
          anticipatedConditions: submissionResult.anticipatedConditions as Prisma.InputJsonArray,
        },
        update: {
          draftText: submissionResult.draftText,
          lenderTarget,
          anticipatedConditions: submissionResult.anticipatedConditions as Prisma.InputJsonArray,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      logger.warn('Submission notes drafting failed', {
        applicationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Step 10: Update application status ────────────────────────────────────
  try {
    if (application.status === 'SUBMITTED') {
      await prisma.application.update({
        where: { id: applicationId },
        data: { status: 'IN_REVIEW' },
      });

      recordStatusChange({
        applicationId,
        fromStatus: 'SUBMITTED',
        toStatus: 'IN_REVIEW',
        changedById: userId,
        note: 'Pipeline processing complete',
      });

      logAction(tenantId, userId, applicationId, 'STATUS_CHANGED', {
        from: 'SUBMITTED',
        to: 'IN_REVIEW',
        triggeredBy: 'pipeline',
      });
    }
  } catch (err) {
    logger.warn('Status update failed', {
      applicationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  updateStatus(applicationId, 'COMPLETE', 100, { completedAt: new Date().toISOString() });
  logger.info('Pipeline complete', { applicationId });
}
