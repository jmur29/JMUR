import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import puppeteer from 'puppeteer';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import prisma from '../prisma/client';
import { generateCreditMemoNarrative, draftSubmissionNotes } from '../ai';
import { s3Client, S3_BUCKET } from '../services/documents';
import { logAction } from '../services/audit';
import logger from '../utils/logger';

// ─── getClassifiedDocuments ───────────────────────────────────────────────────

export async function getClassifiedDocuments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: applicationId } = req.params;
    const { tenantId } = req.user;

    const app = await prisma.application.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
    });
    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    const documents = await prisma.document.findMany({
      where: { applicationId },
      include: {
        classification: true,
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    res.json({ success: true, data: documents });
  } catch (err) {
    next(err);
  }
}

// ─── getDownPayment ───────────────────────────────────────────────────────────

export async function getDownPayment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: applicationId } = req.params;
    const { tenantId } = req.user;

    const app = await prisma.application.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
    });
    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    const entries = await prisma.downPaymentEntry.findMany({
      where: { applicationId, tenantId },
      orderBy: { transactionDate: 'asc' },
    });

    res.json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
}

// ─── getFraudSignals ──────────────────────────────────────────────────────────

export async function getFraudSignals(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: applicationId } = req.params;
    const { tenantId } = req.user;

    const app = await prisma.application.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
    });
    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    const signals = await prisma.fraudSignal.findMany({
      where: { tenantId, document: { applicationId } },
      include: {
        document: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by documentId
    const grouped = signals.reduce<Record<string, typeof signals>>((acc, signal) => {
      const docId = signal.documentId;
      if (!acc[docId]) acc[docId] = [];
      acc[docId].push(signal);
      return acc;
    }, {});

    res.json({ success: true, data: grouped });
  } catch (err) {
    next(err);
  }
}

// ─── getCreditMemo ────────────────────────────────────────────────────────────

export async function getCreditMemo(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: applicationId } = req.params;
    const { tenantId, id: userId } = req.user;

    const app = await prisma.application.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
      include: {
        borrowers: { include: { income: true } },
        property: true,
        creditMemo: true,
      },
    });
    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    // Return existing credit memo if present
    if (app.creditMemo) {
      res.json({ success: true, data: app.creditMemo });
      return;
    }

    // Generate on-demand if not exists
    const primary = app.borrowers.find((b) => b.type === 'PRIMARY');
    const prop = app.property;

    if (!primary || !prop) {
      res.status(422).json({ success: false, error: 'Application data incomplete for credit memo generation' });
      return;
    }

    const toNum = (d: Prisma.Decimal | null | undefined): number =>
      d ? parseFloat(d.toString()) : 0;

    const fraudSignalCount = await prisma.fraudSignal.count({
      where: { tenantId, document: { applicationId } },
    });
    const conditions = await prisma.approvalCondition.findMany({
      where: { applicationId },
      select: { body: true },
    });

    const narrative = await generateCreditMemoNarrative({
      borrowerName: `${primary.firstName} ${primary.lastName}`,
      property: `${prop.address}, ${prop.city}, ${prop.province}`,
      purchasePrice: toNum(prop.purchasePrice),
      downPayment: toNum(prop.downPayment),
      mortgageAmount: toNum(prop.purchasePrice) - toNum(prop.downPayment),
      gds: 0,
      tds: 0,
      ltv: 0,
      stressGds: 0,
      stressTds: 0,
      decision: 'PENDING',
      flags: [],
      fraudSignalCount,
      downPaymentSourced: false,
      conditions: conditions.map((c) => c.body),
    });

    const memo = await prisma.creditMemo.create({
      data: {
        tenantId,
        applicationId,
        gds: new Prisma.Decimal(0),
        tds: new Prisma.Decimal(0),
        qualifyingRate: new Prisma.Decimal(0),
        downPaymentTotal: new Prisma.Decimal(toNum(prop.downPayment)),
        fraudSignalCount,
        narrative,
        aiModel: 'claude-sonnet-4-20250514',
      },
    });

    logAction(tenantId, userId, applicationId, 'CREDIT_MEMO_GENERATED', { memoId: memo.id });

    res.json({ success: true, data: memo });
  } catch (err) {
    next(err);
  }
}

// ─── generateCreditMemoPdf ────────────────────────────────────────────────────

export async function generateCreditMemoPdf(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: applicationId } = req.params;
    const { tenantId, id: userId } = req.user;

    const app = await prisma.application.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
      include: {
        creditMemo: true,
        borrowers: true,
        property: true,
      },
    });
    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }
    if (!app.creditMemo) {
      res.status(404).json({ success: false, error: 'Credit memo not found. Run pipeline first.' });
      return;
    }

    const memo = app.creditMemo;
    const primary = app.borrowers.find((b) => b.type === 'PRIMARY');
    const prop = app.property;

    const toNum = (d: Prisma.Decimal | null | undefined): number =>
      d ? parseFloat(d.toString()) : 0;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Credit Memo — ${app.fileNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #1f2937; background: #fff; padding: 32px; }
    h1 { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 4px; }
    h2 { font-size: 14px; font-weight: 600; color: #374151; margin: 16px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
    .narrative { line-height: 1.7; white-space: pre-wrap; }
    .ratios { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 12px 0; }
    .ratio-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; }
    .ratio-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .ratio-value { font-size: 20px; font-weight: 700; color: #111827; margin-top: 2px; }
    .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <h1>Credit Memo</h1>
  <div class="meta">
    File: ${app.fileNumber} &nbsp;·&nbsp;
    Borrower: ${primary ? `${primary.firstName} ${primary.lastName}` : 'N/A'} &nbsp;·&nbsp;
    Property: ${prop ? `${prop.address}, ${prop.city}` : 'N/A'} &nbsp;·&nbsp;
    Generated: ${new Date().toLocaleDateString('en-CA')}
  </div>

  <h2>Key Ratios</h2>
  <div class="ratios">
    <div class="ratio-card"><div class="ratio-label">GDS</div><div class="ratio-value">${toNum(memo.gds).toFixed(2)}%</div></div>
    <div class="ratio-card"><div class="ratio-label">TDS</div><div class="ratio-value">${toNum(memo.tds).toFixed(2)}%</div></div>
    <div class="ratio-card"><div class="ratio-label">Down Payment</div><div class="ratio-value">$${toNum(memo.downPaymentTotal).toLocaleString('en-CA')}</div></div>
  </div>

  <h2>Narrative</h2>
  <div class="narrative">${(memo.narrative ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>

  <div class="footer">
    <span>ClearPath UW — Confidential</span>
    <span>${app.fileNumber} · Credit Memo</span>
  </div>
</body>
</html>`;

    // Generate PDF with Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    let pdfBuffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
      pdfBuffer = Buffer.from(pdf);
    } finally {
      await browser.close();
    }

    // Upload to S3
    const s3Key = `credit-memos/${tenantId}/${applicationId}/credit-memo-${Date.now()}.pdf`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      }),
    );

    // Update creditMemo record with PDF key
    await prisma.creditMemo.update({
      where: { applicationId },
      data: { pdfS3Key: s3Key },
    });

    // Generate presigned download URL (15 min)
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }),
      { expiresIn: 900 },
    );

    logAction(tenantId, userId, applicationId, 'CREDIT_MEMO_PDF_GENERATED', { s3Key });

    res.json({ success: true, data: { url, s3Key } });
  } catch (err) {
    next(err);
  }
}

// ─── getSubmissionNotes ───────────────────────────────────────────────────────

export async function getSubmissionNotes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: applicationId } = req.params;
    const { tenantId } = req.user;

    const app = await prisma.application.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
    });
    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    const note = await prisma.submissionNote.findUnique({
      where: { applicationId },
    });

    res.json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
}

// ─── generateSubmissionNotes ──────────────────────────────────────────────────

export async function generateSubmissionNotes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: applicationId } = req.params;
    const { tenantId, id: userId } = req.user;
    const { lenderTarget } = req.body as { lenderTarget: string };

    if (!lenderTarget) {
      res.status(400).json({ success: false, error: 'lenderTarget is required' });
      return;
    }

    const app = await prisma.application.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
      include: {
        borrowers: { include: { income: true } },
        property: true,
        decisions: { orderBy: { decidedAt: 'desc' }, take: 1 },
      },
    });
    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    const primary = app.borrowers.find((b) => b.type === 'PRIMARY');
    const prop = app.property;

    if (!primary || !prop) {
      res.status(422).json({ success: false, error: 'Application data incomplete' });
      return;
    }

    const toNum = (d: Prisma.Decimal | null | undefined): number =>
      d ? parseFloat(d.toString()) : 0;

    const latestDecision = app.decisions[0];

    const result = await draftSubmissionNotes(
      {
        borrowerName: `${primary.firstName} ${primary.lastName}`,
        property: `${prop.address}, ${prop.city}, ${prop.province}`,
        purchasePrice: toNum(prop.purchasePrice),
        downPayment: toNum(prop.downPayment),
        gds: latestDecision ? toNum(latestDecision.gds) : 0,
        tds: latestDecision ? toNum(latestDecision.tds) : 0,
        ltv: latestDecision ? toNum(latestDecision.ltv) : 0,
        employmentType: primary.employmentType,
        creditScore: primary.creditScore,
        flags: (latestDecision?.flags as unknown[]) ?? [],
        lenderTarget,
      },
      tenantId,
      applicationId,
      userId,
    );

    const note = await prisma.submissionNote.upsert({
      where: { applicationId },
      create: {
        tenantId,
        applicationId,
        draftText: result.draftText,
        lenderTarget,
        anticipatedConditions: result.anticipatedConditions as Prisma.InputJsonArray,
      },
      update: {
        draftText: result.draftText,
        lenderTarget,
        anticipatedConditions: result.anticipatedConditions as Prisma.InputJsonArray,
        updatedAt: new Date(),
      },
    });

    // Update lenderTarget on application too
    await prisma.application.update({
      where: { id: applicationId },
      data: { lenderTarget },
    });

    logAction(tenantId, userId, applicationId, 'SUBMISSION_NOTES_GENERATED', { lenderTarget });

    res.json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
}

// ─── finalizeSubmissionNotes ──────────────────────────────────────────────────

export async function finalizeSubmissionNotes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: applicationId } = req.params;
    const { tenantId, id: userId } = req.user;

    const app = await prisma.application.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
    });
    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    const existing = await prisma.submissionNote.findUnique({ where: { applicationId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Submission notes not found' });
      return;
    }

    const note = await prisma.submissionNote.update({
      where: { applicationId },
      data: { isFinalized: true, finalizedAt: new Date() },
    });

    logAction(tenantId, userId, applicationId, 'SUBMISSION_NOTES_FINALIZED', {});

    res.json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
}

// ─── acknowledgeFraudSignal ───────────────────────────────────────────────────

export async function acknowledgeFraudSignal(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: applicationId, signalId } = req.params;
    const { tenantId, id: userId } = req.user;

    const app = await prisma.application.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
    });
    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    const signal = await prisma.fraudSignal.findFirst({
      where: { id: signalId, tenantId },
    });
    if (!signal) {
      res.status(404).json({ success: false, error: 'Fraud signal not found' });
      return;
    }

    const updated = await prisma.fraudSignal.update({
      where: { id: signalId },
      data: { acknowledgedAt: new Date(), acknowledgedById: userId },
    });

    logAction(tenantId, userId, applicationId, 'FRAUD_SIGNAL_ACKNOWLEDGED', {
      signalId,
      signalType: signal.signalType,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ─── getAnticipatedConditions ─────────────────────────────────────────────────

export async function getAnticipatedConditions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: applicationId } = req.params;
    const { tenantId } = req.user;

    const app = await prisma.application.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
    });
    if (!app) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }

    const note = await prisma.submissionNote.findUnique({
      where: { applicationId },
      select: { anticipatedConditions: true },
    });

    const conditions = (note?.anticipatedConditions as string[] | null) ?? [];

    res.json({ success: true, data: { conditions } });
  } catch (err) {
    next(err);
  }
}
