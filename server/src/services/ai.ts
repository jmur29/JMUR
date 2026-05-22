import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedApplication {
  borrowerName: string | null;
  dateOfBirth: string | null;
  employmentType: string | null;
  annualIncome: number | null;
  creditScore: number | null;
  propertyAddress: string | null;
  purchasePrice: number | null;
  downPayment: number | null;
  propertyType: string | null;
  mortgageAmount: number | null;
  interestRate: number | null;
  amortizationYears: number | null;
}

export interface UWReview {
  recommendation: 'APPROVE' | 'DECLINE' | 'MANUAL_REVIEW';
  summary: string;
  risk_flags: string[];
  conditions: string[];
  reasoning: string;
}

// ─── Parse submission note ────────────────────────────────────────────────────

export async function parseSubmissionNote(text: string): Promise<ParsedApplication> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are a mortgage underwriting assistant. Extract structured data from broker submission notes.
Always respond with valid JSON only — no explanation, no markdown.`,
    messages: [
      {
        role: 'user',
        content: `Extract the following fields from this broker submission note. Return a JSON object with exactly these keys. Use null for any field not found. Numbers should be numeric (no currency symbols or commas).

Fields:
- borrowerName (string): full name of primary borrower
- dateOfBirth (string): date of birth in YYYY-MM-DD format if determinable, otherwise as written
- employmentType (string): one of SALARIED, SELF_EMPLOYED, HOURLY, CONTRACT, RETIRED, or OTHER
- annualIncome (number): total annual income in dollars
- creditScore (number): credit score as integer
- propertyAddress (string): full property address
- purchasePrice (number): purchase price in dollars
- downPayment (number): down payment amount in dollars
- propertyType (string): one of DETACHED, SEMI_DETACHED, TOWNHOUSE, CONDO, or OTHER
- mortgageAmount (number): mortgage amount in dollars
- interestRate (number): interest rate as a decimal (e.g. 0.0525 for 5.25%)
- amortizationYears (number): amortization period in years

Submission note:
${text}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from AI service');
  }

  try {
    const parsed = JSON.parse(content.text) as ParsedApplication;
    return parsed;
  } catch (err) {
    logger.error('Failed to parse AI response as JSON', { raw: content.text, error: err });
    throw new Error('AI service returned malformed JSON');
  }
}

// ─── Review underwriting file ─────────────────────────────────────────────────

export async function reviewUnderwritingFile(applicationData: object): Promise<UWReview> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a senior mortgage underwriter. Review mortgage applications and provide clear, structured assessments.
Always respond with valid JSON only — no explanation, no markdown.`,
    messages: [
      {
        role: 'user',
        content: `Review the following mortgage application and return a JSON object with exactly these keys:
- recommendation (string): one of APPROVE, DECLINE, or MANUAL_REVIEW
- summary (string): 2-3 sentence plain-language summary of the application
- risk_flags (array of strings): list of risk concerns found (empty array if none)
- conditions (array of strings): list of conditions that must be met before approval (empty array if none)
- reasoning (string): detailed underwriter reasoning explaining the recommendation

Application data:
${JSON.stringify(applicationData, null, 2)}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from AI service');
  }

  try {
    const review = JSON.parse(content.text) as UWReview;
    return review;
  } catch (err) {
    logger.error('Failed to parse AI review response as JSON', { raw: content.text, error: err });
    throw new Error('AI service returned malformed JSON');
  }
}
