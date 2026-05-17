import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { PDFParse } from 'pdf-parse';
import type { RawTransaction } from '../ai';
import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FraudSignalResult {
  signalType: 'METADATA_ANOMALY' | 'FONT_INCONSISTENCY' | 'BALANCE_MISMATCH' | 'EMPLOYER_MISMATCH' | 'ROUND_NUMBER' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence: string;
  recommendedAction: string;
}

// ─── Levenshtein distance (inline) ───────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function stringSimilarity(a: string, b: string): number {
  const norm_a = a.toLowerCase().trim();
  const norm_b = b.toLowerCase().trim();
  if (norm_a === norm_b) return 1;
  const maxLen = Math.max(norm_a.length, norm_b.length);
  if (maxLen === 0) return 1;
  return (maxLen - levenshtein(norm_a, norm_b)) / maxLen;
}

// ─── S3 download helper ───────────────────────────────────────────────────────

async function downloadFromS3(s3Key: string, s3Client: S3Client): Promise<Buffer | null> {
  const bucket = process.env.AWS_S3_BUCKET ?? '';
  if (!bucket) return null;

  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: s3Key });
    const response = await s3Client.send(command);

    if (!response.Body) return null;

    // Collect stream into buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    logger.error('S3 download failed in fraud check', {
      s3Key,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ─── 1. checkPDFMetadata ──────────────────────────────────────────────────────

/**
 * Downloads a PDF from S3, parses its metadata, and checks if ModDate is more than
 * 30 days after CreationDate — which can indicate document tampering.
 */
export async function checkPDFMetadata(s3Key: string, s3Client: S3Client): Promise<FraudSignalResult | null> {
  const buffer = await downloadFromS3(s3Key, s3Client);
  if (!buffer) return null;

  let creationDateRaw: string | undefined;
  let modDateRaw: string | undefined;

  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const infoResult = await parser.getInfo();
    // InfoResult.info is the raw PDF Info dictionary (typed as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dict: Record<string, unknown> = (infoResult.info as any) ?? {};
    creationDateRaw = dict['CreationDate'] as string | undefined;
    modDateRaw = dict['ModDate'] as string | undefined;
    await parser.destroy();
  } catch (err) {
    logger.warn('pdf-parse failed in checkPDFMetadata', {
      s3Key,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  if (!creationDateRaw || !modDateRaw) return null;

  // PDF dates: D:YYYYMMDDHHmmssOHH'mm'  — parse the first 16 chars
  const parsePdfDate = (raw: string): Date | null => {
    // Strip "D:" prefix
    const str = raw.startsWith('D:') ? raw.slice(2) : raw;
    // At minimum we need YYYYMMDD
    if (str.length < 8) return null;
    const year = parseInt(str.slice(0, 4), 10);
    const month = parseInt(str.slice(4, 6), 10) - 1;
    const day = parseInt(str.slice(6, 8), 10);
    const hour = str.length >= 10 ? parseInt(str.slice(8, 10), 10) : 0;
    const minute = str.length >= 12 ? parseInt(str.slice(10, 12), 10) : 0;
    const date = new Date(Date.UTC(year, month, day, hour, minute));
    return isNaN(date.getTime()) ? null : date;
  };

  const creationDate = parsePdfDate(creationDateRaw);
  const modDate = parsePdfDate(modDateRaw);

  if (!creationDate || !modDate) return null;

  const diffMs = modDate.getTime() - creationDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > 30) {
    return {
      signalType: 'METADATA_ANOMALY',
      severity: 'HIGH',
      evidence: `PDF CreationDate is ${creationDateRaw} but ModDate is ${modDateRaw} — a gap of ${Math.round(diffDays)} days suggests the document may have been edited after creation.`,
      recommendedAction: 'Request a fresh copy of the document directly from the issuing institution. Do not accept borrower-provided copy.',
    };
  }

  return null;
}

// ─── 2. checkBalanceIntegrity ─────────────────────────────────────────────────

/**
 * Verifies that for each row with a prior balance: opening + credits - debits = closing balance.
 * Flags any row where the math does not reconcile within $0.01.
 */
export function checkBalanceIntegrity(transactions: RawTransaction[]): FraudSignalResult | null {
  const mismatchedRows: string[] = [];

  for (let i = 1; i < transactions.length; i++) {
    const prev = transactions[i - 1];
    const curr = transactions[i];

    if (prev.balance === null || curr.balance === null) continue;

    const credit = curr.credit ?? 0;
    const debit = curr.debit ?? 0;

    const expected = prev.balance + credit - debit;
    const actual = curr.balance;

    if (Math.abs(expected - actual) > 0.009) {
      mismatchedRows.push(
        `Row ${i + 1} (${curr.date} — ${curr.description}): expected balance $${expected.toFixed(2)}, actual $${actual.toFixed(2)} (diff $${Math.abs(expected - actual).toFixed(2)})`,
      );
    }
  }

  if (mismatchedRows.length === 0) return null;

  return {
    signalType: 'BALANCE_MISMATCH',
    severity: mismatchedRows.length >= 3 ? 'HIGH' : 'MEDIUM',
    evidence: `${mismatchedRows.length} transaction row(s) fail balance reconciliation:\n${mismatchedRows.join('\n')}`,
    recommendedAction: 'Request original bank statements directly from the financial institution via bank portal or fax. Cross-reference with void cheque.',
  };
}

// ─── 3. checkEmployerConsistency ──────────────────────────────────────────────

/**
 * Fuzzy-matches the employer name from a pay stub against the employer from a T4.
 * Flags if similarity < 0.8.
 */
export function checkEmployerConsistency(payStubEmployer: string, t4Employer: string): FraudSignalResult | null {
  if (!payStubEmployer || !t4Employer) return null;

  const similarity = stringSimilarity(payStubEmployer, t4Employer);

  if (similarity < 0.8) {
    return {
      signalType: 'EMPLOYER_MISMATCH',
      severity: 'HIGH',
      evidence: `Pay stub employer "${payStubEmployer}" does not match T4 employer "${t4Employer}" (similarity score: ${(similarity * 100).toFixed(1)}%).`,
      recommendedAction: 'Obtain a letter of employment on company letterhead and verify the employer with CRA My Account or NOA. Cross-reference with T4 slip.',
    };
  }

  return null;
}

// ─── 4. checkRoundNumberDeposits ─────────────────────────────────────────────

const PAYROLL_KEYWORDS = [
  'PAYROLL', 'DIRECT DEPOSIT', 'PAY', 'SALARY', 'WAGES',
  'EMPLOYER', 'ADP', 'CERIDIAN', 'PAYWORKS',
];

/**
 * Flags credit transactions that are round numbers >= $5,000 with no payroll keywords.
 * Round number = amount divisible by 1000 or ending in .00 and >= $5,000.
 */
export function checkRoundNumberDeposits(transactions: RawTransaction[]): FraudSignalResult[] {
  const signals: FraudSignalResult[] = [];

  for (const tx of transactions) {
    const amount = tx.credit;
    if (amount === null || amount < 5000) continue;

    // Check for round number: divisible by 100 with no cents
    const isRound = amount % 100 === 0;
    if (!isRound) continue;

    // Check for payroll keywords
    const descUpper = tx.description.toUpperCase();
    const hasPayrollKeyword = PAYROLL_KEYWORDS.some((kw) => descUpper.includes(kw));
    if (hasPayrollKeyword) continue;

    signals.push({
      signalType: 'ROUND_NUMBER',
      severity: amount >= 10000 ? 'HIGH' : 'MEDIUM',
      evidence: `Credit of $${amount.toFixed(2)} on ${tx.date} ("${tx.description}") is a round-number deposit ≥ $5,000 with no identifiable payroll source.`,
      recommendedAction: 'Request a Letter of Explanation from the borrower documenting the source of this deposit. If a gift, obtain a signed Gift Letter.',
    });
  }

  return signals;
}
