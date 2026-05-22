import AdmZip from 'adm-zip';
import pdfParse from 'pdf-parse';
import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import {
  classifyDocument,
  classifyDocumentImage,
  assembleDealFromDocuments,
  parseFinmoPdf,
  parseSubmissionNote,
  ClassifiedDocument,
  DealIntelligenceReport,
} from './ai';
import { generateFileNumber } from '../utils/fileNumber';

// ─── Image MIME helpers ───────────────────────────────────────────────────────

const IMAGE_EXTS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/jpeg', // Claude doesn't support heic natively — treat as jpeg base64
};

function getImageMime(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTS[ext] ?? null;
}

function isPdf(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf');
}

// ─── Classify a single document (text or image) ───────────────────────────────

export async function classifyAndExtract(
  filename: string,
  content: string | Buffer,
  isImage: boolean
): Promise<ClassifiedDocument> {
  try {
    if (isImage && Buffer.isBuffer(content)) {
      const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpeg';
      const mimeType = IMAGE_EXTS[ext] ?? 'image/jpeg';
      const base64 = content.toString('base64');
      return await classifyDocumentImage(filename, base64, mimeType);
    }

    const textContent = typeof content === 'string' ? content : content.toString('utf-8');
    return await classifyDocument(filename, textContent);
  } catch (err) {
    logger.error(`classifyAndExtract failed for ${filename}`, { err });
    // Return a fallback classified document so processing can continue
    return {
      filename,
      detectedType: 'UNKNOWN',
      status: 'REVIEW',
      confidence: 0,
      keyDataExtracted: 'Classification failed — manual review required',
      extractedData: {},
      issues: [`Auto-classification error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

// ─── Assemble deal intelligence from classified documents ─────────────────────

export async function assembleDealIntelligence(
  documents: ClassifiedDocument[],
  applicationId: string
): Promise<DealIntelligenceReport> {
  const report = await assembleDealFromDocuments(documents);
  report.applicationId = applicationId;
  return report;
}

// ─── Process zip upload ───────────────────────────────────────────────────────

function isZipBuffer(buf: Buffer): boolean {
  // ZIP magic bytes: PK\x03\x04
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

export async function processZipUpload(
  applicationId: string,
  zipBuffer: Buffer,
  tenantId: string,
  originalFilename = 'upload'
): Promise<DealIntelligenceReport> {
  // Mark as PROCESSING
  await prisma.application.update({
    where: { id: applicationId },
    data: { processingStatus: 'PROCESSING' },
  });

  try {
    // If not a ZIP, treat as a single document file
    if (!isZipBuffer(zipBuffer)) {
      const doc = await classifyAndExtract(
        originalFilename,
        isPdf(originalFilename) ? (await pdfParse(zipBuffer)).text : zipBuffer,
        !!getImageMime(originalFilename)
      );
      const report = await assembleDealIntelligence([doc], applicationId);
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          processingStatus: 'COMPLETE',
          dealIntelligenceReport: report as unknown as Prisma.InputJsonValue,
          dealAnalyzedAt: new Date(),
        },
      });
      return report;
    }

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    const classifiedDocs: ClassifiedDocument[] = [];

    for (const entry of entries) {
      // Skip directories, macOS metadata, and hidden files
      if (entry.isDirectory) continue;
      const entryName = entry.entryName;
      if (entryName.includes('__MACOSX') || entryName.includes('.DS_Store')) continue;

      const filename = entry.name;
      if (!filename || filename.startsWith('.')) continue;

      const fileBuffer = entry.getData();
      const imageMime = getImageMime(filename);

      let doc: ClassifiedDocument;

      if (isPdf(filename)) {
        // Extract text from PDF
        let textContent = '';
        try {
          const parsed = await pdfParse(fileBuffer);
          textContent = parsed.text;
        } catch (pdfErr) {
          logger.warn(`PDF parse failed for ${filename}`, { pdfErr });
          textContent = `[PDF text extraction failed for: ${filename}]`;
        }
        doc = await classifyAndExtract(filename, textContent, false);
      } else if (imageMime) {
        doc = await classifyAndExtract(filename, fileBuffer, true);
      } else {
        // Try to read as text (txt, csv, etc.)
        const textContent = fileBuffer.toString('utf-8');
        doc = await classifyAndExtract(filename, textContent, false);
      }

      classifiedDocs.push(doc);
      logger.info(`Classified ${filename} as ${doc.detectedType} (${doc.confidence.toFixed(2)})`);
    }

    // Assemble deal intelligence
    const report = await assembleDealIntelligence(classifiedDocs, applicationId);

    // Save to application
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        processingStatus: 'COMPLETE',
        dealIntelligenceReport: report as unknown as Prisma.InputJsonValue,
        dealAnalyzedAt: new Date(),
      },
    });

    logger.info(`processZipUpload complete for application ${applicationId}`, {
      docCount: classifiedDocs.length,
      readinessScore: report.readinessScore.total,
    });

    return report;
  } catch (err) {
    logger.error(`processZipUpload failed for application ${applicationId}`, { err });
    await prisma.application.update({
      where: { id: applicationId },
      data: { processingStatus: 'FAILED' },
    });
    throw err;
  }
}

// ─── Process Finmo PDF ────────────────────────────────────────────────────────

export async function processFinmoPdf(
  applicationId: string,
  pdfBuffer: Buffer,
  tenantId = 'default'
): Promise<void> {
  await prisma.application.update({
    where: { id: applicationId },
    data: { processingStatus: 'PROCESSING' },
  });

  try {
    const parsed = await pdfParse(pdfBuffer);
    const pdfText = parsed.text;

    const appData = await parseFinmoPdf(pdfText);

    // Upsert borrower
    const existingBorrower = await prisma.borrower.findFirst({
      where: { applicationId, type: 'PRIMARY' },
    });

    if (existingBorrower) {
      await prisma.borrower.update({
        where: { id: existingBorrower.id },
        data: {
          ...(appData.firstName ? { firstName: appData.firstName } : {}),
          ...(appData.lastName ? { lastName: appData.lastName } : {}),
          ...(appData.dob ? { dob: new Date(appData.dob) } : {}),
          ...(appData.email ? { email: appData.email } : {}),
          ...(appData.phone ? { phone: appData.phone } : {}),
          ...(appData.employmentType ? { employmentType: appData.employmentType } : {}),
          ...(appData.creditScore !== null ? { creditScore: appData.creditScore } : {}),
        },
      });

      const existingIncome = await prisma.income.findUnique({
        where: { borrowerId: existingBorrower.id },
      });
      if (existingIncome) {
        await prisma.income.update({
          where: { borrowerId: existingBorrower.id },
          data: {
            ...(appData.employerName ? { employerName: appData.employerName } : {}),
            ...(appData.yearsEmployed !== null ? { yearsEmployed: appData.yearsEmployed } : {}),
            ...(appData.baseSalary !== null ? { baseSalary: appData.baseSalary } : {}),
          },
        });
      } else if (appData.baseSalary !== null || appData.employerName) {
        await prisma.income.create({
          data: {
            borrowerId: existingBorrower.id,
            employerName: appData.employerName ?? undefined,
            yearsEmployed: appData.yearsEmployed ?? undefined,
            baseSalary: appData.baseSalary ?? 0,
          },
        });
      }
    } else if (appData.firstName && appData.lastName) {
      const borrower = await prisma.borrower.create({
        data: {
          applicationId,
          type: 'PRIMARY',
          firstName: appData.firstName,
          lastName: appData.lastName,
          dob: appData.dob ? new Date(appData.dob) : new Date('1990-01-01'),
          email: appData.email ?? '',
          phone: appData.phone ?? '',
          sinEncrypted: '',
          employmentType: appData.employmentType ?? 'EMPLOYED',
          creditScore: appData.creditScore ?? 0,
        },
      });

      if (appData.baseSalary !== null || appData.employerName) {
        await prisma.income.create({
          data: {
            borrowerId: borrower.id,
            employerName: appData.employerName ?? undefined,
            yearsEmployed: appData.yearsEmployed ?? undefined,
            baseSalary: appData.baseSalary ?? 0,
          },
        });
      }
    }

    // Upsert property
    const propertyData = {
      address: appData.address ?? '',
      city: appData.city ?? '',
      province: appData.province ?? 'ON',
      postalCode: appData.postalCode ?? '',
      propertyType: (appData.propertyType ?? 'DETACHED') as
        | 'DETACHED'
        | 'SEMI'
        | 'TOWNHOUSE'
        | 'CONDO'
        | 'DUPLEX'
        | 'OTHER',
      occupancy: 'OWNER' as const,
      purchasePrice: appData.purchasePrice ?? 0,
      appraisedValue: appData.purchasePrice ?? 0,
      downPayment: appData.downPayment ?? 0,
      annualTax: 0,
      monthlyHeat: 150,
    };

    const existingProperty = await prisma.property.findUnique({
      where: { applicationId },
    });
    if (existingProperty) {
      await prisma.property.update({
        where: { applicationId },
        data: propertyData,
      });
    } else if (appData.address || appData.purchasePrice) {
      await prisma.property.create({
        data: { applicationId, ...propertyData },
      });
    }

    // Upsert mortgage terms
    if (appData.contractRate || appData.amortizationYears) {
      const contractRate = appData.contractRate ?? 5.5;
      const stressRate = Math.max(contractRate + 2, 5.25);
      const mortgageAmount = (appData.purchasePrice ?? 0) - (appData.downPayment ?? 0);

      const termsData = {
        contractRate,
        stressRate,
        amortizationYears: appData.amortizationYears ?? 25,
        termYears: appData.termYears ?? 5,
        insured: mortgageAmount > 0 && (appData.purchasePrice ?? 0) > 0
          ? (appData.downPayment ?? 0) / (appData.purchasePrice ?? 1) < 0.2
          : false,
        monthlyPayment: 0,
        mortgageAmount,
      };

      const existingTerms = await prisma.mortgageTerms.findUnique({
        where: { applicationId },
      });
      if (existingTerms) {
        await prisma.mortgageTerms.update({ where: { applicationId }, data: termsData });
      } else {
        await prisma.mortgageTerms.create({ data: { applicationId, ...termsData } });
      }
    }

    logger.info(`processFinmoPdf data saved for application ${applicationId}, starting intelligence generation`);

    // Auto-generate deal intelligence after data is parsed
    await generateDealIntelligenceFromApplication(applicationId, tenantId);

    logger.info(`processFinmoPdf complete for application ${applicationId}`);
  } catch (err) {
    logger.error(`processFinmoPdf failed for application ${applicationId}`, { err });
    await prisma.application.update({
      where: { id: applicationId },
      data: { processingStatus: 'FAILED' },
    });
    throw err;
  }
}

// ─── Process submission notes ─────────────────────────────────────────────────

export async function processSubmissionNotes(
  applicationId: string,
  text: string,
  tenantId = 'default'
): Promise<void> {
  await prisma.application.update({
    where: { id: applicationId },
    data: { processingStatus: 'PROCESSING' },
  });

  try {
    const appData = await parseSubmissionNote(text);

    // Upsert borrower
    const existingBorrower = await prisma.borrower.findFirst({
      where: { applicationId, type: 'PRIMARY' },
    });

    if (existingBorrower) {
      await prisma.borrower.update({
        where: { id: existingBorrower.id },
        data: {
          ...(appData.firstName ? { firstName: appData.firstName } : {}),
          ...(appData.lastName ? { lastName: appData.lastName } : {}),
          ...(appData.dob ? { dob: new Date(appData.dob) } : {}),
          ...(appData.email ? { email: appData.email } : {}),
          ...(appData.phone ? { phone: appData.phone } : {}),
          ...(appData.employmentType ? { employmentType: appData.employmentType } : {}),
          ...(appData.creditScore !== null ? { creditScore: appData.creditScore } : {}),
        },
      });

      const existingIncome = await prisma.income.findUnique({
        where: { borrowerId: existingBorrower.id },
      });
      if (existingIncome) {
        await prisma.income.update({
          where: { borrowerId: existingBorrower.id },
          data: {
            ...(appData.employerName ? { employerName: appData.employerName } : {}),
            ...(appData.yearsEmployed !== null ? { yearsEmployed: appData.yearsEmployed } : {}),
            ...(appData.baseSalary !== null ? { baseSalary: appData.baseSalary } : {}),
          },
        });
      } else if (appData.baseSalary !== null || appData.employerName) {
        await prisma.income.create({
          data: {
            borrowerId: existingBorrower.id,
            employerName: appData.employerName ?? undefined,
            yearsEmployed: appData.yearsEmployed ?? undefined,
            baseSalary: appData.baseSalary ?? 0,
          },
        });
      }
    } else if (appData.firstName && appData.lastName) {
      const borrower = await prisma.borrower.create({
        data: {
          applicationId,
          type: 'PRIMARY',
          firstName: appData.firstName,
          lastName: appData.lastName,
          dob: appData.dob ? new Date(appData.dob) : new Date('1990-01-01'),
          email: appData.email ?? '',
          phone: appData.phone ?? '',
          sinEncrypted: '',
          employmentType: appData.employmentType ?? 'EMPLOYED',
          creditScore: appData.creditScore ?? 0,
        },
      });

      if (appData.baseSalary !== null || appData.employerName) {
        await prisma.income.create({
          data: {
            borrowerId: borrower.id,
            employerName: appData.employerName ?? undefined,
            yearsEmployed: appData.yearsEmployed ?? undefined,
            baseSalary: appData.baseSalary ?? 0,
          },
        });
      }
    }

    // Upsert property
    if (appData.address || appData.purchasePrice) {
      const propertyData = {
        address: appData.address ?? '',
        city: appData.city ?? '',
        province: appData.province ?? 'ON',
        postalCode: appData.postalCode ?? '',
        propertyType: (appData.propertyType ?? 'DETACHED') as
          | 'DETACHED'
          | 'SEMI'
          | 'TOWNHOUSE'
          | 'CONDO'
          | 'DUPLEX'
          | 'OTHER',
        occupancy: 'OWNER' as const,
        purchasePrice: appData.purchasePrice ?? 0,
        appraisedValue: appData.purchasePrice ?? 0,
        downPayment: appData.downPayment ?? 0,
        annualTax: 0,
        monthlyHeat: 150,
      };

      const existingProperty = await prisma.property.findUnique({
        where: { applicationId },
      });
      if (existingProperty) {
        await prisma.property.update({ where: { applicationId }, data: propertyData });
      } else {
        await prisma.property.create({ data: { applicationId, ...propertyData } });
      }
    }

    // Upsert mortgage terms
    if (appData.contractRate || appData.amortizationYears) {
      const contractRate = appData.contractRate ?? 5.5;
      const stressRate = Math.max(contractRate + 2, 5.25);
      const mortgageAmount = (appData.purchasePrice ?? 0) - (appData.downPayment ?? 0);

      const termsData = {
        contractRate,
        stressRate,
        amortizationYears: appData.amortizationYears ?? 25,
        termYears: appData.termYears ?? 5,
        insured: mortgageAmount > 0 && (appData.purchasePrice ?? 0) > 0
          ? (appData.downPayment ?? 0) / (appData.purchasePrice ?? 1) < 0.2
          : false,
        monthlyPayment: 0,
        mortgageAmount,
      };

      const existingTerms = await prisma.mortgageTerms.findUnique({
        where: { applicationId },
      });
      if (existingTerms) {
        await prisma.mortgageTerms.update({ where: { applicationId }, data: termsData });
      } else {
        await prisma.mortgageTerms.create({ data: { applicationId, ...termsData } });
      }
    }

    logger.info(`processSubmissionNotes data saved for application ${applicationId}, starting intelligence generation`);

    // Auto-generate deal intelligence after data is parsed
    await generateDealIntelligenceFromApplication(applicationId, tenantId);

    logger.info(`processSubmissionNotes complete for application ${applicationId}`);
  } catch (err) {
    logger.error(`processSubmissionNotes failed for application ${applicationId}`, { err });
    await prisma.application.update({
      where: { id: applicationId },
      data: { processingStatus: 'FAILED' },
    });
    throw err;
  }
}

// ─── Generate deal intelligence from existing application data ────────────────

export async function generateDealIntelligenceFromApplication(
  applicationId: string,
  tenantId: string
): Promise<void> {
  await prisma.application.update({
    where: { id: applicationId },
    data: { processingStatus: 'PROCESSING' },
  });

  try {
    const app = await prisma.application.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
      include: {
        borrowers: { include: { income: true } },
        property: true,
        mortgageTerms: true,
        documents: true,
      },
    });

    if (!app) throw new Error('Application not found');

    // Build synthetic ClassifiedDocuments from stored documents + application data
    const docs: ClassifiedDocument[] = app.documents.map((d) => ({
      filename: d.name,
      s3Key: d.s3Key ?? undefined,
      url: d.url ?? undefined,
      detectedType: (d.type as ClassifiedDocument['detectedType']) ?? 'UNKNOWN',
      status: (d.status === 'REVIEWED' ? 'GOOD' : 'REVIEW') as 'GOOD' | 'REVIEW' | 'MISSING',
      confidence: 0.8,
      keyDataExtracted: `${d.type} — ${d.name}`,
      extractedData: {},
      issues: [],
    }));

    // If no documents, create a summary document from application data
    if (docs.length === 0) {
      const primary = app.borrowers.find((b) => b.type === 'PRIMARY') ?? app.borrowers[0];
      const summaryText = [
        primary ? `Borrower: ${primary.firstName} ${primary.lastName}` : '',
        app.property ? `Property: ${app.property.address}, value ${Number(app.property.appraisedValue)}` : '',
        app.mortgageTerms ? `Mortgage: ${Number(app.mortgageTerms.mortgageAmount)} at ${Number(app.mortgageTerms.contractRate)}%` : '',
      ].filter(Boolean).join('\n');

      if (summaryText) {
        const doc = await classifyAndExtract('application-data.txt', summaryText, false);
        docs.push(doc);
      }
    }

    const report = await assembleDealIntelligence(docs, applicationId);

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        processingStatus: 'COMPLETE',
        dealIntelligenceReport: report as unknown as Prisma.InputJsonValue,
        dealAnalyzedAt: new Date(),
      },
    });

    logger.info(`generateDealIntelligenceFromApplication complete for ${applicationId}`);
  } catch (err) {
    logger.error(`generateDealIntelligenceFromApplication failed for ${applicationId}`, { err });
    await prisma.application.update({
      where: { id: applicationId },
      data: { processingStatus: 'FAILED' },
    });
    throw err;
  }
}
