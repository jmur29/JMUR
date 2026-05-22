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
  mortgageType: 'PURCHASE' | 'SWITCH' | 'REFINANCE' | 'RENEWAL' | null;
  existingMortgageBalance: number | null;
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

// ─── Document intake types ────────────────────────────────────────────────────

export type DocumentDetectedType =
  | 'T4'
  | 'NOA'
  | 'PAY_STUB'
  | 'BANK_STATEMENT'
  | 'EMPLOYMENT_LETTER'
  | 'PURCHASE_AGREEMENT'
  | 'GIFT_LETTER'
  | 'MORTGAGE_STATEMENT'
  | 'PHOTO_ID'
  | 'UTILITY_BILL'
  | 'APPRAISAL'
  | 'OTHER'
  | 'UNKNOWN';

export interface ClassifiedDocument {
  filename: string;
  detectedType: DocumentDetectedType;
  status: 'GOOD' | 'REVIEW' | 'MISSING';
  confidence: number;
  keyDataExtracted: string;
  extractedData: Record<string, unknown>;
  issues: string[];
}

export interface ReadinessScore {
  total: number;
  documentsComplete: number;
  incomeVerifiable: number;
  downPaymentSourced: number;
  liabilitiesComplete: number;
  identityVerified: number;
}

export interface DownPaymentSummary {
  totalSourced: number;
  required: number;
  unexplainedDeposits: number;
  daysOfHistory: number;
  giftLetterRequired: boolean;
}

export interface IncomeSummary {
  t4_2023?: number;
  t4_2022?: number;
  noaConfirmed?: number;
  twoYearAverage?: number;
  monthlyQualifying?: number;
  employmentVerified: boolean;
}

export interface RatiosSummary {
  gds: number;
  tds: number;
  ltv: number;
  qualifyingRate: number;
}

export interface DealIntelligenceReport {
  applicationId: string;
  readinessScore: ReadinessScore;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  dealType: 'PURCHASE' | 'REFINANCE' | 'SWITCH' | 'RENEWAL' | 'UNKNOWN';
  lenderTier: 'A' | 'B' | 'MIC' | 'UNKNOWN';
  documents: ClassifiedDocument[];
  income: IncomeSummary;
  downPayment: DownPaymentSummary;
  liabilities: unknown[];
  ratios: RatiosSummary;
  missingItems: string[];
  aiAdvisory: string;
  recommendedLenders: string[];
  primaryLenderFit: string;
}

export interface FraudSignal {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  type: string;
  evidence: string;
  aiExplanation: string;
  recommendation: string;
}

export interface DealReviewReport {
  applicationId: string;
  dealQualityScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  decision: 'APPROVE' | 'DECLINE' | 'MANUAL_REVIEW';
  fraudSignals: FraudSignal[];
  conditions: string[];
  summary: string;
  strengths: string[];
  weaknesses: string[];
  lenderRecommendation: string;
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
    max_tokens: 1200,
    system: `You are an expert Canadian mortgage broker assistant with deep knowledge of Finmo, BOSS, Expert Mortgage Software, and standard broker submission formats. Extract structured data from any submission note format. Respond with valid JSON only — no markdown, no explanation.`,
    messages: [{
      role: 'user',
      content: `Extract all available mortgage application fields from the text below. Return JSON with exactly these keys. Use null for missing fields. All monetary values must be numbers (no $ or commas). Rates as decimal numbers (e.g. 5.49 not 5.49%). For mortgageType: detect "purchase", "switch/transfer", "refinance", or "renewal".

{
  "firstName": string|null,
  "lastName": string|null,
  "dob": "YYYY-MM-DD"|null,
  "email": string|null,
  "phone": string|null,
  "employmentType": "EMPLOYED"|"SELF_EMPLOYED"|"CONTRACT"|"RETIRED"|"OTHER"|null,
  "creditScore": number|null,
  "baseSalary": number|null,
  "employerName": string|null,
  "yearsEmployed": number|null,
  "address": string|null,
  "city": string|null,
  "province": "ON"|"BC"|"AB"|"QC"|"MB"|"SK"|"NS"|"NB"|"NL"|"PE"|"NT"|"NU"|"YT"|null,
  "postalCode": string|null,
  "propertyType": "DETACHED"|"SEMI"|"TOWNHOUSE"|"CONDO"|"DUPLEX"|"OTHER"|null,
  "purchasePrice": number|null,
  "downPayment": number|null,
  "contractRate": number|null,
  "amortizationYears": number|null,
  "termYears": number|null,
  "mortgageType": "PURCHASE"|"SWITCH"|"REFINANCE"|"RENEWAL"|null,
  "existingMortgageBalance": number|null
}

Notes on extraction:
- For switch/transfer: purchasePrice = property value, downPayment = equity (value minus balance)
- SIN numbers should be ignored (privacy)
- DOB formats: handle MM/DD/YYYY, YYYY-MM-DD, "born March 5 1985", etc.
- Salary: annualize if given as hourly/monthly (e.g. $25/hr × 2080 = $52,000)
- Look for: "beacon", "credit score", "bureau" for creditScore
- Look for: "amort", "AM", "amortization" for amortizationYears

Submission text:
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
    system: `You are Canada's most experienced senior mortgage underwriter — 25 years across TD, RBC, First National, Home Trust, and Equitable Bank. You have deep knowledge of:
- OSFI B-20 stress test (qualifying at higher of contract+2% or 5.25%)
- CMHC/Sagen/Canada Guaranty insured mortgage rules (LTV >80% requires insurance; max purchase price $1.5M)
- Big 6 bank A policies (beacon 660+ for best rates, TDS ≤44%, GDS ≤39%)
- Monoline A lenders (First National, MCAP, RMG, CMLS, Merix)
- B lenders (Home Trust, Equitable Bank, Haventree, MCAN)
- MIC lenders (CMI, Fisgard, Romspen, CMLS MIC) for edge cases
- Common deal structures: purchase, switch/transfer, refinance, renewal
- Debt service: GDS includes P&I + tax + heat + 50% condo fees; TDS adds all other monthly debt
- Quebec specifics, BC foreign buyer rules, Ontario Land Transfer Tax implications

You provide expert deal analysis as if you personally would sign off on this file.
Respond with valid JSON only — no markdown, no explanation.`,
    messages: [{
      role: 'user',
      content: `Analyze this Canadian mortgage application. If computedRatios are provided, use them as ground truth — they are calculated by the underwriting engine. Return comprehensive deal intelligence as JSON:

{
  "dealScore": <integer 0-100>,
  "grade": <"A"|"B"|"C"|"D"|"F">,
  "recommendation": <"APPROVE"|"DECLINE"|"MANUAL_REVIEW">,
  "headline": <1 punchy sentence, max 12 words — be specific about THIS deal>,
  "summary": <2-3 sentence expert summary a broker can read in 10 seconds>,
  "gdsComment": <expert 1-sentence insight on GDS — include the actual number if available>,
  "tdsComment": <expert 1-sentence insight on TDS — include the actual number if available>,
  "ltvComment": <expert 1-sentence insight on LTV — include the actual number if available>,
  "lenderMatches": [
    {
      "lender": <exact Canadian lender name>,
      "tier": <"A"|"B"|"MIC">,
      "fitScore": <integer 0-100>,
      "verdict": <"STRONG"|"POSSIBLE"|"UNLIKELY">,
      "reasons": [<specific reason this lender works — max 2, be specific>],
      "concerns": [<specific concern — max 2, be specific>]
    }
  ],
  "riskFlags": [
    {
      "severity": <"HIGH"|"MEDIUM"|"LOW"|"INFO">,
      "category": <"Credit"|"Income"|"Property"|"LTV"|"Employment"|"Stress Test"|"Documentation"|"Fraud">,
      "message": <specific, actionable risk description — include numbers>
    }
  ],
  "conditions": [<UW condition in professional format, e.g. "Obtain 2 years NOA confirming income of $95,000 per annum">],
  "dealCoaching": [
    {
      "tip": <specific broker action with dollar amounts or percentages>,
      "impact": <what this change does to the deal outcome>
    }
  ],
  "fraudAlerts": [<specific inconsistency or fraud indicator — empty array if none>],
  "strengthSummary": <1 sentence on the deal's single biggest strength — be specific>,
  "weaknessSummary": <1 sentence on the deal's single biggest weakness — be specific>
}

Scoring guide:
- 85-100 = A (clean A lender approval, multiple options)
- 70-84 = B (A lender approval with conditions, or strong B lender)
- 55-69 = C (B lender or A lender with heavy conditions)
- 40-54 = D (B lender with conditions, or MIC required)
- 0-39 = F (decline all channels or pending critical docs)

Lender coverage requirements:
- Include 6-8 lenders: at minimum TD/RBC (or similar Big 6), First National, MCAP, Home Trust, Equitable Bank, plus 1 MIC
- A lender minimums: beacon 660+, GDS ≤39%, TDS ≤44%, stress test pass, stable employment
- B lender sweet spots: beacon 550-659, higher ratios, BFS/self-employed, recent credit events
- If any data is missing, flag it HIGH severity and still assess based on available information

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

// ─── Document classification ──────────────────────────────────────────────────

const CLASSIFY_PROMPT = `You are a Canadian mortgage document specialist. Analyze this document and return JSON with exactly these keys. No markdown, no explanation.
{
  "detectedType": "T4"|"NOA"|"PAY_STUB"|"BANK_STATEMENT"|"EMPLOYMENT_LETTER"|"PURCHASE_AGREEMENT"|"GIFT_LETTER"|"MORTGAGE_STATEMENT"|"PHOTO_ID"|"UTILITY_BILL"|"APPRAISAL"|"OTHER"|"UNKNOWN",
  "status": "GOOD"|"REVIEW"|"MISSING",
  "confidence": <0.0-1.0>,
  "keyDataExtracted": "<human-readable 1-line summary of what was found>",
  "extractedData": {<structured key-value pairs of all relevant fields>},
  "issues": [<list of concerns or problems with this document>]
}`;

export async function classifyDocument(
  filename: string,
  textContent: string
): Promise<ClassifiedDocument> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `${CLASSIFY_PROMPT}\n\nDocument filename: ${filename}\nDocument content: ${textContent}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected AI response type');
  const parsed = parseJson<Omit<ClassifiedDocument, 'filename'>>(content.text, 'classifyDocument');
  return { filename, ...parsed };
}

export async function classifyDocumentImage(
  filename: string,
  base64Image: string,
  mimeType: string
): Promise<ClassifiedDocument> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
              data: base64Image,
            },
          },
          { type: 'text', text: `${CLASSIFY_PROMPT}\n\nDocument filename: ${filename}` },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected AI response type');
  const parsed = parseJson<Omit<ClassifiedDocument, 'filename'>>(content.text, 'classifyDocumentImage');
  return { filename, ...parsed };
}

// ─── Deal assembly from documents ─────────────────────────────────────────────

export async function assembleDealFromDocuments(
  documents: ClassifiedDocument[]
): Promise<DealIntelligenceReport> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are Canada's most experienced senior mortgage underwriter. Analyze extracted mortgage documents and produce a comprehensive deal intelligence report. Respond with valid JSON only — no markdown, no explanation.`,
    messages: [
      {
        role: 'user',
        content: `Analyze these extracted mortgage documents and produce a DealIntelligenceReport JSON. Use "UNKNOWN" as applicationId — the caller will inject it.

Documents data:
${JSON.stringify(documents, null, 2)}

Return JSON with exactly this structure:
{
  "applicationId": "UNKNOWN",
  "readinessScore": {
    "total": <0-100>,
    "documentsComplete": <0-40>,
    "incomeVerifiable": <0-20>,
    "downPaymentSourced": <0-20>,
    "liabilitiesComplete": <0-10>,
    "identityVerified": <0-10>
  },
  "confidence": "HIGH"|"MEDIUM"|"LOW",
  "dealType": "PURCHASE"|"REFINANCE"|"SWITCH"|"RENEWAL"|"UNKNOWN",
  "lenderTier": "A"|"B"|"MIC"|"UNKNOWN",
  "documents": <the classified documents array>,
  "income": {
    "t4_2023": <number|null>,
    "t4_2022": <number|null>,
    "noaConfirmed": <number|null>,
    "twoYearAverage": <number|null>,
    "monthlyQualifying": <number|null>,
    "employmentVerified": <boolean>
  },
  "downPayment": {
    "totalSourced": <number>,
    "required": <number>,
    "unexplainedDeposits": <number>,
    "daysOfHistory": <number>,
    "giftLetterRequired": <boolean>
  },
  "liabilities": [],
  "ratios": { "gds": <number>, "tds": <number>, "ltv": <number>, "qualifyingRate": <number> },
  "missingItems": [<list of missing/required items>],
  "aiAdvisory": "<2-3 paragraph expert advisory for the broker>",
  "recommendedLenders": [<list of lender names>],
  "primaryLenderFit": "<single best lender>"
}

Readiness score guide:
- Documents complete (0-40): T4 present +15, NOA present +10, bank statement 90-day +10, ID present +5
- Income verifiable (0-20): T4 matches NOA +10, 2+ years of T4s +10
- Down payment sourced (0-20): 90 days history +10, no unexplained deposits >5K +10
- Liabilities complete (0-10): any liabilities statement or bank stmt present +10
- Identity verified (0-10): photo ID present +10`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected AI response type');
  return parseJson<DealIntelligenceReport>(content.text, 'assembleDealFromDocuments');
}

// ─── Finmo PDF parse ──────────────────────────────────────────────────────────

export async function parseFinmoPdf(pdfText: string): Promise<ParsedApplication> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: `You are an expert Canadian mortgage broker assistant with deep knowledge of Finmo mortgage origination software exports. Extract all deal fields from the Finmo PDF text. Respond with valid JSON only — no markdown, no explanation.`,
    messages: [
      {
        role: 'user',
        content: `Extract all available mortgage application fields from this Finmo PDF export. Return JSON with exactly these keys. Use null for missing fields. All monetary values must be numbers (no $ or commas). Rates as decimal numbers (e.g. 5.49 not 5.49%).

{
  "firstName": string|null,
  "lastName": string|null,
  "dob": "YYYY-MM-DD"|null,
  "email": string|null,
  "phone": string|null,
  "employmentType": "EMPLOYED"|"SELF_EMPLOYED"|"CONTRACT"|"RETIRED"|"OTHER"|null,
  "creditScore": number|null,
  "baseSalary": number|null,
  "employerName": string|null,
  "yearsEmployed": number|null,
  "address": string|null,
  "city": string|null,
  "province": "ON"|"BC"|"AB"|"QC"|"MB"|"SK"|"NS"|"NB"|"NL"|"PE"|"NT"|"NU"|"YT"|null,
  "postalCode": string|null,
  "propertyType": "DETACHED"|"SEMI"|"TOWNHOUSE"|"CONDO"|"DUPLEX"|"OTHER"|null,
  "purchasePrice": number|null,
  "downPayment": number|null,
  "contractRate": number|null,
  "amortizationYears": number|null,
  "termYears": number|null,
  "mortgageType": "PURCHASE"|"SWITCH"|"REFINANCE"|"RENEWAL"|null,
  "existingMortgageBalance": number|null
}

Finmo PDF text:
${pdfText}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected AI response type');
  return parseJson<ParsedApplication>(content.text, 'parseFinmoPdf');
}

// ─── Deal review (underwriter advisory) ──────────────────────────────────────

export async function buildDealReview(
  applicationData: object,
  fraudSignals: FraudSignal[]
): Promise<DealReviewReport> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are Canada's most experienced senior mortgage underwriter — 25 years across TD, RBC, First National, Home Trust, and Equitable Bank. You produce objective, rigorous deal review reports for underwriters. Respond with valid JSON only — no markdown, no explanation.`,
    messages: [
      {
        role: 'user',
        content: `Produce a comprehensive DealReviewReport for this mortgage application. Include all fraud signals provided.

Application data:
${JSON.stringify(applicationData, null, 2)}

Known fraud signals:
${JSON.stringify(fraudSignals, null, 2)}

Return JSON with exactly this structure:
{
  "applicationId": "UNKNOWN",
  "dealQualityScore": <0-100>,
  "riskLevel": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL",
  "decision": "APPROVE"|"DECLINE"|"MANUAL_REVIEW",
  "fraudSignals": <the fraud signals array, enhanced with aiExplanation>,
  "conditions": [<list of underwriting conditions>],
  "summary": "<2-3 sentence expert summary>",
  "strengths": [<deal strengths>],
  "weaknesses": [<deal weaknesses>],
  "lenderRecommendation": "<specific lender recommendation with rationale>"
}

Deal quality score guide:
- 85-100 = Clean A-lender approval with minimal conditions
- 70-84 = A-lender with standard conditions, or strong B-lender
- 55-69 = B-lender or A-lender with heavy conditions
- 40-54 = B-lender with conditions or MIC
- 0-39 = Decline or critical issues`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected AI response type');
  return parseJson<DealReviewReport>(content.text, 'buildDealReview');
}
