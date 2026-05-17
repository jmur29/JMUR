import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import prisma from '../prisma/client';
import logger from '../utils/logger';

const client = new Anthropic(); // uses ANTHROPIC_API_KEY env var
const AI_MODEL = 'claude-sonnet-4-20250514';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RawTransaction = {
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
};

export type DownPaymentSourcingEntry = {
  transactionDate: string;
  description: string;
  amount: number;
  runningBalance: number | null;
  category: string;
  isFlagged: boolean;
  flagReason: string | null;
  loeRequired: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function logAiAudit(opts: {
  tenantId: string;
  applicationId?: string;
  documentId?: string;
  action: string;
  prompt: string;
  response: string;
  inputTokens?: number;
  outputTokens?: number;
  userId: string;
}): Promise<void> {
  try {
    await prisma.aiAuditEntry.create({
      data: {
        tenantId: opts.tenantId,
        applicationId: opts.applicationId,
        documentId: opts.documentId,
        action: opts.action,
        aiModel: AI_MODEL,
        promptHash: sha256(opts.prompt),
        responseHash: sha256(opts.response),
        inputTokens: opts.inputTokens,
        outputTokens: opts.outputTokens,
        userId: opts.userId,
      },
    });
  } catch (err) {
    logger.error('Failed to log AiAuditEntry', {
      action: opts.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function parseJsonResponse<T>(text: string, context: string): T {
  // Strip markdown code fences if present
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    throw new Error(`Failed to parse JSON from Claude response for ${context}: ${text.slice(0, 200)}`);
  }
}

// ─── classifyDocument ─────────────────────────────────────────────────────────

export async function classifyDocument(
  ocrText: string,
  tenantId: string,
  documentId: string,
  userId: string,
): Promise<{ classifiedType: string; confidence: number; extractedFields: Record<string, unknown> }> {
  const prompt = `You are a Canadian mortgage document classifier. Analyze the following OCR-extracted text from a mortgage application document.

Classify the document into exactly one of these types:
T4 | NOA | PAY_STUB | BANK_STATEMENT | GIFT_LETTER | PURCHASE_AGREEMENT | EMPLOYMENT_LETTER | MORTGAGE_STATEMENT | PHOTO_ID | OTHER

Extract relevant fields based on document type:
- T4/NOA: borrowerName, employer, income, taxYear, sinLast3
- PAY_STUB: borrowerName, employer, payPeriodEnd, grossPay, ytdGross
- BANK_STATEMENT: accountHolder, institution, accountNumberLast4, statementPeriod, openingBalance, closingBalance
- GIFT_LETTER: donorName, borrowerName, giftAmount, relationship
- PURCHASE_AGREEMENT: propertyAddress, purchasePrice, closingDate, buyerName, sellerName
- EMPLOYMENT_LETTER: borrowerName, employer, position, annualSalary, startDate
- MORTGAGE_STATEMENT: lender, outstandingBalance, monthlyPayment, propertyAddress
- PHOTO_ID: name, dateOfBirth, idType, expiryDate
- OTHER: any identifiable fields

If you are uncertain about a field value, explicitly use null rather than guessing.

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "classifiedType": "T4",
  "confidence": 0.95,
  "extractedFields": {
    "borrowerName": "Jane Smith",
    "employer": "ACME Corp",
    "income": 85000,
    "taxYear": "2024"
  }
}

OCR TEXT:
${ocrText}`;

  let responseText = '';
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;

  try {
    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = message.content[0];
    if (!block || block.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }
    responseText = block.text;
    inputTokens = message.usage.input_tokens;
    outputTokens = message.usage.output_tokens;
  } catch (err) {
    throw new Error(`Claude API error in classifyDocument: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await logAiAudit({
      tenantId,
      documentId,
      action: 'CLASSIFY_DOCUMENT',
      prompt,
      response: responseText,
      inputTokens,
      outputTokens,
      userId,
    });
  }

  return parseJsonResponse<{ classifiedType: string; confidence: number; extractedFields: Record<string, unknown> }>(
    responseText,
    'classifyDocument',
  );
}

// ─── sourceDownPayment ────────────────────────────────────────────────────────

export async function sourceDownPayment(
  transactions: RawTransaction[],
  monthlyIncome: number | null,
  tenantId: string,
  applicationId: string,
  userId: string,
): Promise<{ entries: DownPaymentSourcingEntry[] }> {
  const prompt = `You are a Canadian mortgage underwriter specializing in down payment verification under OSFI B-20 guidelines.

You will be given a list of bank transactions and the borrower's monthly income. Analyze each CREDIT transaction (money coming in) to:
1. Categorize it: PAYROLL | ETRANSFER | WIRE | CASH | INVESTMENT | GIFT | GOVERNMENT | UNKNOWN
2. Flag it if it is a large deposit (>25% of monthly income, or >$5,000 if income is unknown) that cannot be clearly attributed to payroll
3. Determine if a Letter of Explanation (LOE) is required (for flagged, non-payroll deposits)

Payroll keywords: PAYROLL, DIRECT DEPOSIT, PAY, SALARY, WAGES, EMPLOYER, ADP, CERIDIAN, PAYWORKS

Government keywords: CRA, GST, CERB, OAS, CPP, EI, ODSP, CHILD BENEFIT, CCB, ONTARIO

If you are uncertain about a transaction's source, flag it and explain your reasoning rather than assuming it is legitimate.

Monthly Income: ${monthlyIncome !== null ? `$${monthlyIncome.toFixed(2)}/month` : 'Unknown'}
Large deposit threshold: ${monthlyIncome !== null ? `$${(monthlyIncome * 0.25).toFixed(2)} (25% of monthly income)` : '$5,000.00 (default)'}

Transactions (all entries, analyze credits):
${JSON.stringify(transactions, null, 2)}

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "entries": [
    {
      "transactionDate": "2024-01-15",
      "description": "PAYROLL ACME CORP",
      "amount": 3500.00,
      "runningBalance": 12500.00,
      "category": "PAYROLL",
      "isFlagged": false,
      "flagReason": null,
      "loeRequired": false
    }
  ]
}

Include ALL transactions (debits too — for context), but only flag/analyze credits. Debit entries should have isFlagged: false and loeRequired: false.`;

  let responseText = '';
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;

  try {
    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = message.content[0];
    if (!block || block.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }
    responseText = block.text;
    inputTokens = message.usage.input_tokens;
    outputTokens = message.usage.output_tokens;
  } catch (err) {
    throw new Error(`Claude API error in sourceDownPayment: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await logAiAudit({
      tenantId,
      applicationId,
      action: 'SOURCE_DOWN_PAYMENT',
      prompt,
      response: responseText,
      inputTokens,
      outputTokens,
      userId,
    });
  }

  return parseJsonResponse<{ entries: DownPaymentSourcingEntry[] }>(responseText, 'sourceDownPayment');
}

// ─── draftLOE ─────────────────────────────────────────────────────────────────

export async function draftLOE(
  flaggedDeposit: { transactionDate: Date; description: string; amount: number; flagReason: string | null },
  borrowerName: string,
): Promise<string> {
  const prompt = `You are a Canadian mortgage broker assistant. Draft a brief, professional Letter of Explanation (LOE) for a flagged bank deposit.

The letter should:
- Be addressed "To Whom It May Concern" or to the lender
- Explain the source of the deposit in plain, factual language
- Reference the specific date and amount
- Be signed off by the borrower's name
- Be 2-4 short paragraphs maximum
- Sound natural and professional, not templated

Borrower Name: ${borrowerName}
Transaction Date: ${flaggedDeposit.transactionDate.toISOString().split('T')[0]}
Amount: $${flaggedDeposit.amount.toFixed(2)}
Description on Statement: ${flaggedDeposit.description}
Flag Reason: ${flaggedDeposit.flagReason ?? 'Large unattributed deposit requiring explanation'}

Return ONLY the letter text (plain text, no JSON, no markdown). The letter should be professional and ready to be signed.`;

  let responseText = '';

  try {
    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = message.content[0];
    if (!block || block.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }
    responseText = block.text;
  } catch (err) {
    throw new Error(`Claude API error in draftLOE: ${err instanceof Error ? err.message : String(err)}`);
  }

  return responseText;
}

// ─── generateCreditMemoNarrative ─────────────────────────────────────────────

export async function generateCreditMemoNarrative(context: {
  borrowerName: string;
  property: string;
  purchasePrice: number;
  downPayment: number;
  mortgageAmount: number;
  gds: number;
  tds: number;
  ltv: number;
  stressGds: number;
  stressTds: number;
  decision: string;
  flags: unknown[];
  fraudSignalCount: number;
  downPaymentSourced: boolean;
  conditions: string[];
}): Promise<string> {
  const prompt = `You are a senior Canadian mortgage underwriter. Write a professional credit memo narrative for the following mortgage application.

The narrative should:
- Summarize the borrower's profile and the subject property
- Comment on the key ratios (GDS, TDS, LTV) relative to OSFI B-20 guidelines (GDS ≤ 39%, TDS ≤ 44%)
- Note the stress test results
- Address any underwriting flags with context
- Comment on down payment sourcing status
- Note fraud signal count if non-zero
- List recommended conditions
- End with the overall credit recommendation
- Be 3-5 paragraphs, professional underwriting voice, no jargon acronyms without explanation

Application Data:
${JSON.stringify(context, null, 2)}

Return ONLY the narrative text (plain text, no JSON, no markdown headers). Write in third person (e.g., "The subject application...").`;

  let responseText = '';

  try {
    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = message.content[0];
    if (!block || block.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }
    responseText = block.text;
  } catch (err) {
    throw new Error(`Claude API error in generateCreditMemoNarrative: ${err instanceof Error ? err.message : String(err)}`);
  }

  return responseText;
}

// ─── explainFraudSignal ───────────────────────────────────────────────────────

export async function explainFraudSignal(signal: {
  signalType: string;
  evidence: string;
  documentName: string;
}): Promise<string> {
  const prompt = `You are a Canadian mortgage fraud analyst. Explain the following fraud signal to an underwriter in plain language.

Your explanation should:
- Describe what this type of signal means and why it is suspicious
- Explain the specific evidence found in this document
- Recommend what additional verification steps should be taken
- Be 2-3 sentences, concise and factual
- If you are uncertain about the severity given only this information, say so explicitly

Signal Type: ${signal.signalType}
Document: ${signal.documentName}
Evidence: ${signal.evidence}

Return ONLY the explanation text (plain text, no JSON, no markdown).`;

  let responseText = '';

  try {
    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = message.content[0];
    if (!block || block.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }
    responseText = block.text;
  } catch (err) {
    throw new Error(`Claude API error in explainFraudSignal: ${err instanceof Error ? err.message : String(err)}`);
  }

  return responseText;
}

// ─── draftSubmissionNotes ─────────────────────────────────────────────────────

export async function draftSubmissionNotes(
  context: {
    borrowerName: string;
    property: string;
    purchasePrice: number;
    downPayment: number;
    gds: number;
    tds: number;
    ltv: number;
    employmentType: string;
    creditScore: number;
    flags: unknown[];
    lenderTarget: string;
  },
  tenantId: string,
  applicationId: string,
  userId: string,
): Promise<{ draftText: string; anticipatedConditions: string[] }> {
  const prompt = `You are a Canadian mortgage broker preparing a lender submission package. Draft submission notes for the target lender and list anticipated conditions they will likely impose.

Submission notes should:
- Be addressed to the lender's underwriting team
- Highlight borrower strengths
- Pre-address any potential concerns proactively
- Reference the target lender by name
- Be professional and concise (3-5 paragraphs)

Anticipated conditions are typically: employment verification, NOA confirmation, void cheque, property appraisal, title insurance, fire insurance, etc. Tailor to this file's specific risks.

Application Data:
${JSON.stringify(context, null, 2)}

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "draftText": "Dear [Lender] Underwriting Team,\\n\\n...",
  "anticipatedConditions": [
    "Confirmation of employment letter dated within 30 days",
    "2 years NOA from CRA",
    "..."
  ]
}`;

  let responseText = '';
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;

  try {
    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = message.content[0];
    if (!block || block.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }
    responseText = block.text;
    inputTokens = message.usage.input_tokens;
    outputTokens = message.usage.output_tokens;
  } catch (err) {
    throw new Error(`Claude API error in draftSubmissionNotes: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await logAiAudit({
      tenantId,
      applicationId,
      action: 'DRAFT_SUBMISSION_NOTES',
      prompt,
      response: responseText,
      inputTokens,
      outputTokens,
      userId,
    });
  }

  return parseJsonResponse<{ draftText: string; anticipatedConditions: string[] }>(
    responseText,
    'draftSubmissionNotes',
  );
}
