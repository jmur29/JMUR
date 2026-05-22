import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedApplication {
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
  email: string | null;
  phone: string | null;
  employmentType: 'EMPLOYED' | 'SELF_EMPLOYED' | 'CONTRACT' | 'RETIRED' | 'OTHER' | null;
  creditScore: number | null;
  baseSalary: number | null;
  employerName: string | null;
  yearsEmployed: number | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  propertyType: 'DETACHED' | 'SEMI' | 'TOWNHOUSE' | 'CONDO' | 'DUPLEX' | 'OTHER' | null;
  purchasePrice: number | null;
  downPayment: number | null;
  contractRate: number | null;
  amortizationYears: number | null;
  termYears: number | null;
}

export interface LenderMatch {
  lender: string;
  tier: 'A' | 'B' | 'MIC';
  fitScore: number;
  verdict: 'STRONG' | 'POSSIBLE' | 'UNLIKELY';
  reasons: string[];
  concerns: string[];
}

export interface RiskFlag {
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  message: string;
}

export interface DealCoach {
  tip: string;
  impact: string;
}

export interface DealIntelligence {
  dealScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendation: 'APPROVE' | 'DECLINE' | 'MANUAL_REVIEW';
  headline: string;
  summary: string;
  gdsComment: string;
  tdsComment: string;
  ltvComment: string;
  lenderMatches: LenderMatch[];
  riskFlags: RiskFlag[];
  conditions: string[];
  dealCoaching: DealCoach[];
  fraudAlerts: string[];
  strengthSummary: string;
  weaknessSummary: string;
}

export interface UWReview {
  recommendation: 'APPROVE' | 'DECLINE' | 'MANUAL_REVIEW';
  summary: string;
  risk_flags: string[];
  conditions: string[];
  reasoning: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJson<T>(raw: string, context: string): T {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    logger.error(`Failed to parse AI JSON [${context}]`, { raw, err });
    throw new Error('AI returned malformed JSON');
  }
}

// ─── Parse submission note ────────────────────────────────────────────────────

export async function parseSubmissionNote(text: string): Promise<ParsedApplication> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'You are a Canadian mortgage underwriting assistant. Extract structured data from broker submission notes. Respond with valid JSON only — no markdown, no explanation.',
    messages: [{
      role: 'user',
      content: `Extract these fields from the submission note. Return JSON with exactly these keys. Use null for missing fields. Numbers as numeric values only (no $ or commas).

{
  "firstName": string | null,
  "lastName": string | null,
  "dob": "YYYY-MM-DD" | null,
  "email": string | null,
  "phone": string | null,
  "employmentType": "EMPLOYED" | "SELF_EMPLOYED" | "CONTRACT" | "RETIRED" | "OTHER" | null,
  "creditScore": number | null,
  "baseSalary": number | null,
  "employerName": string | null,
  "yearsEmployed": number | null,
  "address": string | null,
  "city": string | null,
  "province": "ON"|"BC"|"AB"|"QC"|"MB"|"SK"|"NS"|"NB"|"NL"|"PE"|"NT"|"NU"|"YT" | null,
  "postalCode": string | null,
  "propertyType": "DETACHED"|"SEMI"|"TOWNHOUSE"|"CONDO"|"DUPLEX"|"OTHER" | null,
  "purchasePrice": number | null,
  "downPayment": number | null,
  "contractRate": number | null,
  "amortizationYears": number | null,
  "termYears": number | null
}

Submission note:
${text}`,
    }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected AI response type');
  return parseJson<ParsedApplication>(content.text, 'parseSubmissionNote');
}

// ─── Full deal intelligence ───────────────────────────────────────────────────

export async function analyzeDeal(applicationData: object): Promise<DealIntelligence> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are Canada's most experienced senior mortgage underwriter with 25 years of experience across Big 6 banks, monoline lenders, and B lenders. You have deep knowledge of Canadian mortgage guidelines, OSFI B-20 stress test rules, CMHC insured mortgage rules, and individual lender policies.

You provide brutally honest, expert-level deal analysis. You know exactly which lenders will approve a deal and why. You give brokers the coaching they need to get deals done.

Respond with valid JSON only — no markdown, no explanation.`,
    messages: [{
      role: 'user',
      content: `Analyze this Canadian mortgage application and return a comprehensive deal intelligence report as JSON with exactly this structure:

{
  "dealScore": <integer 0-100>,
  "grade": <"A"|"B"|"C"|"D"|"F">,
  "recommendation": <"APPROVE"|"DECLINE"|"MANUAL_REVIEW">,
  "headline": <one punchy sentence summarizing the deal, max 12 words>,
  "summary": <2-3 sentence plain-language deal summary for a broker>,
  "gdsComment": <expert 1-sentence commentary on the GDS ratio>,
  "tdsComment": <expert 1-sentence commentary on the TDS ratio>,
  "ltvComment": <expert 1-sentence commentary on the LTV>,
  "lenderMatches": [
    {
      "lender": <lender name>,
      "tier": <"A"|"B"|"MIC">,
      "fitScore": <integer 0-100>,
      "verdict": <"STRONG"|"POSSIBLE"|"UNLIKELY">,
      "reasons": [<why this lender works, max 2 items>],
      "concerns": [<what might be an issue, max 2 items>]
    }
  ],
  "riskFlags": [
    {
      "severity": <"HIGH"|"MEDIUM"|"LOW"|"INFO">,
      "category": <e.g. "Credit", "Income", "Property", "LTV", "Employment">,
      "message": <concise risk description>
    }
  ],
  "conditions": [<specific condition required before approval, professional UW language>],
  "dealCoaching": [
    {
      "tip": <specific actionable advice for the broker to improve this deal>,
      "impact": <what approving this change would do>
    }
  ],
  "fraudAlerts": [<any inconsistencies or fraud indicators found, empty array if none>],
  "strengthSummary": <1 sentence on the deal's biggest strength>,
  "weaknessSummary": <1 sentence on the deal's biggest weakness>
}

Rules:
- dealScore 80-100 = Grade A (strong approval), 65-79 = B (approve with conditions), 50-64 = C (manual review), 35-49 = D (B lender), 0-34 = F (decline)
- Include 6-8 lenderMatches covering: TD, RBC, Scotiabank, First National, MCAP, Home Trust, Equitable Bank, and one MIC
- Base lender assessments on real Canadian guidelines: A lenders need beacon 620+, GDS ≤39%, TDS ≤44%; B lenders more flexible; stress test at higher of contract+2% or 5.25%
- riskFlags should be specific and actionable, not generic
- conditions should be professional UW language a senior underwriter would actually write
- dealCoaching should be specific dollar amounts or actions, not vague advice
- If data is missing, flag it as a risk but still assess based on what's available

Application data:
${JSON.stringify(applicationData, null, 2)}`,
    }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected AI response type');
  return parseJson<DealIntelligence>(content.text, 'analyzeDeal');
}

// ─── Legacy review (kept for compatibility) ───────────────────────────────────

export async function reviewUnderwritingFile(applicationData: object): Promise<UWReview> {
  const intel = await analyzeDeal(applicationData);
  return {
    recommendation: intel.recommendation,
    summary: intel.summary,
    risk_flags: intel.riskFlags.map((f) => f.message),
    conditions: intel.conditions,
    reasoning: intel.headline,
  };
}
