import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Seed constants ───────────────────────────────────────────────────────────

const SEED_TENANT_ID = 'seed-tenant-id';
const SEED_USER_ID = 'seed-user-id';
const PLACEHOLDER_URL = 'https://placehold.co/600x800/E8E6E1/1A1916?text=Document';
const PLACEHOLDER_S3 = 'seed/placeholder.pdf';

// ─── Deal intelligence reports ────────────────────────────────────────────────

const sarahChenDealIntelligence = {
  applicationId: 'SEED_APP_1',
  readinessScore: {
    total: 88,
    documentsComplete: 35,
    incomeVerifiable: 20,
    downPaymentSourced: 18,
    liabilitiesComplete: 8,
    identityVerified: 7,
  },
  confidence: 'HIGH',
  dealType: 'PURCHASE',
  lenderTier: 'A',
  documents: [
    {
      filename: 'sarah_chen_t4_2023.pdf',
      detectedType: 'T4',
      status: 'GOOD',
      confidence: 0.97,
      keyDataExtracted: 'T4 2023 — Deloitte Canada — $112,000 employment income',
      extractedData: { year: 2023, employer: 'Deloitte Canada', employmentIncome: 112000 },
      issues: [],
    },
    {
      filename: 'sarah_chen_noa_2023.pdf',
      detectedType: 'NOA',
      status: 'GOOD',
      confidence: 0.95,
      keyDataExtracted: 'NOA 2023 — total income $112,000 — assessed',
      extractedData: { year: 2023, totalIncome: 112000, balanceOwing: 0 },
      issues: [],
    },
    {
      filename: 'sarah_chen_bank_stmt.pdf',
      detectedType: 'BANK_STATEMENT',
      status: 'GOOD',
      confidence: 0.93,
      keyDataExtracted: '93-day bank statement — TD Bank — closing balance $121,450',
      extractedData: { bank: 'TD Bank', daysOfHistory: 93, closingBalance: 121450, unexplainedDeposits: 0 },
      issues: [],
    },
    {
      filename: 'sarah_chen_id.pdf',
      detectedType: 'PHOTO_ID',
      status: 'GOOD',
      confidence: 0.91,
      keyDataExtracted: "Ontario driver's licence — Sarah Chen — DOB 1988-03-15",
      extractedData: { idType: "Driver's Licence", province: 'ON', name: 'Sarah Chen', dob: '1988-03-15' },
      issues: [],
    },
  ],
  income: {
    t4_2023: 112000,
    t4_2022: 108000,
    noaConfirmed: 112000,
    twoYearAverage: 110000,
    monthlyQualifying: 9167,
    employmentVerified: true,
  },
  downPayment: {
    totalSourced: 109800,
    required: 27450,
    unexplainedDeposits: 0,
    daysOfHistory: 93,
    giftLetterRequired: false,
  },
  liabilities: [],
  ratios: { gds: 31.2, tds: 31.2, ltv: 80.0, qualifyingRate: 7.49 },
  missingItems: [],
  aiAdvisory:
    'This is a strong A-lender file ready for submission. Sarah Chen presents excellent employment stability with 5 years at Deloitte Canada and strong income of $112,000 annually, confirmed by matching T4 and NOA. The 20% down payment eliminates CMHC insurance requirements. GDS of 31.2% is comfortably within the 39% limit.\n\nRecommended lender tier: A-lender\nStrongest fit: First National or RBC — strong employment history and clean credit profile at 742 beacon.\n\nThis file is ready to submit immediately. Expected conditions: standard — employment confirmation, closing cost confirmation.',
  recommendedLenders: ['First National', 'RBC', 'TD', 'Scotiabank'],
  primaryLenderFit: 'First National',
};

const derekAishaDealIntelligence = {
  applicationId: 'SEED_APP_2',
  readinessScore: {
    total: 61,
    documentsComplete: 25,
    incomeVerifiable: 20,
    downPaymentSourced: 8,
    liabilitiesComplete: 8,
    identityVerified: 0,
  },
  confidence: 'MEDIUM',
  dealType: 'PURCHASE',
  lenderTier: 'A',
  documents: [
    {
      filename: 'derek_tran_t4_2023.pdf',
      detectedType: 'T4',
      status: 'GOOD',
      confidence: 0.94,
      keyDataExtracted: 'T4 2023 — Ontario Government — $95,000',
      extractedData: { year: 2023, employer: 'Ontario Government', employmentIncome: 95000 },
      issues: [],
    },
    {
      filename: 'aisha_tran_t4_2023.pdf',
      detectedType: 'T4',
      status: 'GOOD',
      confidence: 0.93,
      keyDataExtracted: 'T4 2023 — RBC Royal Bank — $78,000',
      extractedData: { year: 2023, employer: 'RBC Royal Bank', employmentIncome: 78000 },
      issues: [],
    },
    {
      filename: 'derek_aisha_noa_2023.pdf',
      detectedType: 'NOA',
      status: 'GOOD',
      confidence: 0.91,
      keyDataExtracted: 'NOA 2023 — combined income confirmed',
      extractedData: { year: 2023, totalIncome: 173000 },
      issues: [],
    },
    {
      filename: 'bank_statement_partial.pdf',
      detectedType: 'BANK_STATEMENT',
      status: 'REVIEW',
      confidence: 0.82,
      keyDataExtracted: '87-day bank statement — unexplained $22,000 deposit on day 45',
      extractedData: { daysOfHistory: 87, unexplainedDeposits: 22000 },
      issues: ['Only 87 days of history — 90 days required', 'Unexplained deposit of $22,000 — gift letter required'],
    },
  ],
  income: {
    t4_2023: 173000,
    noaConfirmed: 173000,
    twoYearAverage: 168000,
    monthlyQualifying: 14000,
    employmentVerified: true,
  },
  downPayment: {
    totalSourced: 108000,
    required: 36000,
    unexplainedDeposits: 22000,
    daysOfHistory: 87,
    giftLetterRequired: true,
  },
  liabilities: [],
  ratios: { gds: 35.8, tds: 38.2, ltv: 85.0, qualifyingRate: 7.74 },
  missingItems: [
    { severity: 'REQUIRED', description: 'Gift letter required for $22,000 unexplained deposit' },
    { severity: 'REQUIRED', description: '3 additional days of bank history needed to meet 90-day rule (currently 87 days)' },
  ],
  aiAdvisory:
    'Strong dual-income file with good employment stability but two outstanding documentation issues. Combined income of $173,000 is solid and both T4s confirm employment. The main risk item is the $22,000 unexplained deposit — a gift letter is mandatory before submission.\n\nThe bank statement is 87 days — falling 3 days short of the 90-day requirement. Request updated statement immediately as this is easily resolved.\n\nOnce these two items are resolved this is a straightforward A-lender approval at the 85% LTV insured tier.',
  recommendedLenders: ['First National', 'MCAP', 'TD', 'RBC'],
  primaryLenderFit: 'First National',
};

const marcusWebbDealIntelligence = {
  applicationId: 'SEED_APP_3',
  readinessScore: {
    total: 94,
    documentsComplete: 40,
    incomeVerifiable: 20,
    downPaymentSourced: 20,
    liabilitiesComplete: 8,
    identityVerified: 6,
  },
  confidence: 'HIGH',
  dealType: 'REFINANCE',
  lenderTier: 'A',
  documents: [
    {
      filename: 'marcus_webb_t4_2023.pdf',
      detectedType: 'T4',
      status: 'GOOD',
      confidence: 0.96,
      keyDataExtracted: 'T4 2023 — Webb Financial Services — $148,000',
      extractedData: { year: 2023, employer: 'Webb Financial Services', employmentIncome: 148000 },
      issues: [],
    },
    {
      filename: 'marcus_webb_noa_2023.pdf',
      detectedType: 'NOA',
      status: 'GOOD',
      confidence: 0.95,
      keyDataExtracted: 'NOA 2023 — total income $148,000',
      extractedData: { year: 2023, totalIncome: 148000 },
      issues: [],
    },
    {
      filename: 'marcus_webb_bank_stmt.pdf',
      detectedType: 'BANK_STATEMENT',
      status: 'GOOD',
      confidence: 0.94,
      keyDataExtracted: '95-day bank statement — CIBC — no unexplained deposits',
      extractedData: { daysOfHistory: 95, unexplainedDeposits: 0 },
      issues: [],
    },
    {
      filename: 'marcus_webb_id.pdf',
      detectedType: 'PHOTO_ID',
      status: 'GOOD',
      confidence: 0.92,
      keyDataExtracted: "Ontario driver's licence — Marcus Webb",
      extractedData: { idType: "Driver's Licence", name: 'Marcus Webb' },
      issues: [],
    },
    {
      filename: 'marcus_webb_appraisal.pdf',
      detectedType: 'APPRAISAL',
      status: 'GOOD',
      confidence: 0.97,
      keyDataExtracted: 'Certified appraisal — 29 Heritage Hill Road — $620,000',
      extractedData: { appraisedValue: 620000, address: '29 Heritage Hill Road', date: '2026-04-10' },
      issues: [],
    },
  ],
  income: {
    t4_2023: 148000,
    t4_2022: 142000,
    noaConfirmed: 148000,
    twoYearAverage: 145000,
    monthlyQualifying: 12083,
    employmentVerified: true,
  },
  downPayment: {
    totalSourced: 240000,
    required: 0,
    unexplainedDeposits: 0,
    daysOfHistory: 95,
    giftLetterRequired: false,
  },
  liabilities: [],
  ratios: { gds: 22.1, tds: 22.1, ltv: 61.3, qualifyingRate: 7.29 },
  missingItems: [],
  aiAdvisory:
    "Excellent self-employed file with 7 years business history. Marcus Webb's income is well-documented with matching T4 and NOA across multiple years. At 61% LTV this refinance has significant equity cushion — well below the 80% threshold.\n\nSelf-employed files at this income level with 7+ years history are prime A-lender candidates. The appraisal is current and confirms the property value.\n\nRecommend submission to B2B Bank or First National BFS product immediately. Expected conditions: 2 years business financials, current NOA.",
  recommendedLenders: ['First National BFS', 'B2B Bank', 'RBC', 'TD'],
  primaryLenderFit: 'First National BFS',
};

// ─── Deal review reports ──────────────────────────────────────────────────────

const okonkwoDealReview = {
  applicationId: 'SEED_APP_4',
  dealQualityScore: {
    total: 91,
    ratioHealth: 28,
    documentCompleteness: 24,
    incomeVerification: 20,
    downPaymentSourcing: 13,
    fraudSignalClean: 6,
  },
  riskLevel: 'LOW',
  engineOutput: {
    gds: 28.4,
    tds: 28.4,
    ltv: 67.0,
    stressGds: 33.8,
    stressTds: 33.8,
    qualifyingRate: 7.59,
    cmhcRequired: false,
    cmhcPremium: 0,
    decision: 'APPROVE',
    flags: [
      { type: 'PASS', message: '774 beacon — top-tier credit profile', field: 'creditScore' },
      { type: 'PASS', message: 'GDS 28.4% — well within 39% limit', field: 'gds' },
      { type: 'PASS', message: 'TDS 28.4% — well within 44% limit', field: 'tds' },
      { type: 'PASS', message: 'LTV 67.0% — conventional, no CMHC required', field: 'ltv' },
      { type: 'PASS', message: 'Stress TDS 33.8% — passes stress test comfortably', field: 'stressTds' },
    ],
  },
  incomeVerification: [
    { label: 'T4 Income (2023)', value: '$131,000', status: 'PASS' },
    { label: 'Employer', value: 'TD Bank', status: 'PASS' },
    { label: 'Employment Length', value: '6 years', status: 'PASS' },
    { label: 'NOA Confirmation', value: 'Confirmed $131,000', status: 'PASS' },
    { label: 'Employment Letter', value: 'Received — within 30 days', status: 'PASS' },
  ],
  downPaymentVerification: {
    totalSubmitted: 203000,
    sourced: 203000,
    unexplained: 0,
    required: 30750,
  },
  documents: [
    {
      filename: 'T4 2023 — TD Bank',
      detectedType: 'T4',
      status: 'GOOD',
      confidence: 0.97,
      keyDataExtracted: 'T4 2023 — TD Bank — $131,000 employment income',
      extractedData: { year: 2023, employer: 'TD Bank', employmentIncome: 131000 },
      issues: [],
    },
    {
      filename: 'Notice of Assessment 2023',
      detectedType: 'NOA',
      status: 'GOOD',
      confidence: 0.95,
      keyDataExtracted: 'NOA 2023 — total income $131,000 — assessed, balance owing $0',
      extractedData: { year: 2023, totalIncome: 131000, balanceOwing: 0 },
      issues: [],
    },
    {
      filename: 'Bank Statement — 90 Days',
      detectedType: 'BANK_STATEMENT',
      status: 'GOOD',
      confidence: 0.94,
      keyDataExtracted: '90-day statement — TD Bank — closing balance $215,000 — no unexplained deposits',
      extractedData: { bank: 'TD Bank', daysOfHistory: 90, closingBalance: 215000, unexplainedDeposits: 0 },
      issues: [],
    },
    {
      filename: 'Government Photo ID',
      detectedType: 'PHOTO_ID',
      status: 'GOOD',
      confidence: 0.92,
      keyDataExtracted: "Ontario driver's licence — Jerome Okonkwo — valid",
      extractedData: { idType: "Driver's Licence", province: 'ON', name: 'Jerome Okonkwo' },
      issues: [],
    },
    {
      filename: 'Employment Letter — TD Bank',
      detectedType: 'EMPLOYMENT_LETTER',
      status: 'GOOD',
      confidence: 0.96,
      keyDataExtracted: 'Employment letter — TD Bank — Full-time, 6 years — $131,000/yr',
      extractedData: { employer: 'TD Bank', employmentType: 'Full-time', yearsEmployed: 6, salary: 131000 },
      issues: [],
    },
  ],
  fraudSignals: [],
  aiAdvisory:
    "Jerome Okonkwo presents one of the cleanest A-lender files in this cohort. The 774 beacon score places him in the top tier for available rates at any major lender. Six years with TD Bank demonstrates exceptional employment stability — a factor that will satisfy any lender's employment confirmation requirement without exceptions.\n\nThe 33% down payment at 67% LTV eliminates CMHC insurance entirely and gives substantial equity protection. GDS of 28.4% and TDS of 28.4% are well within the 39%/44% guidelines, and the stress test at 33.8% TDS passes comfortably with room to spare.\n\nThis file is ready for immediate submission to First National or TD. Expected conditions: standard documentation confirmation only. No exceptions required. Target approval timeline: 24 hours.",
  recommendedDecision: 'APPROVE',
  recommendedConditions: [
    'Confirm employment letter dated within 30 days of funding',
    'Confirm closing costs of minimum $18,450 available',
    'Final MLS listing confirmation at agreed purchase price of $615,000',
  ],
  creditMemoHtml:
    '<h2>Credit Memo — Jerome Okonkwo</h2><p><strong>File:</strong> CL-0004 | <strong>Date:</strong> 2026-05-18 | <strong>Decision:</strong> APPROVE</p><h3>Borrower</h3><p>Jerome Okonkwo — employed at TD Bank, 6 years. Credit: 774. Income: $131,000 T4.</p><h3>Property</h3><p>88 Lakeview Avenue, Toronto ON — Semi-Detached — Purchase Price $615,000 — Down Payment $203,000 (33%).</p><h3>Ratios</h3><p>GDS: 28.4% | TDS: 28.4% | LTV: 67.0% | Stress TDS: 33.8% — All within guidelines.</p><h3>Recommendation</h3><p>Approve. Clean A-lender file. No exceptions required. Submit to First National or TD Bank.</p>',
};

const fontaineDealReview = {
  applicationId: 'SEED_APP_5',
  dealQualityScore: {
    total: 67,
    ratioHealth: 18,
    documentCompleteness: 20,
    incomeVerification: 15,
    downPaymentSourcing: 9,
    fraudSignalClean: 5,
  },
  riskLevel: 'MEDIUM',
  engineOutput: {
    gds: 36.2,
    tds: 39.8,
    ltv: 78.0,
    stressGds: 42.1,
    stressTds: 46.3,
    qualifyingRate: 7.84,
    cmhcRequired: false,
    cmhcPremium: 0,
    decision: 'MANUAL_REVIEW',
    flags: [
      { type: 'WARN', message: "Employer name mismatch — T4 'Accenture Canada Inc' vs letter 'Accenture Inc'", field: 'employment' },
      { type: 'WARN', message: '641 beacon — borderline A-lender threshold of 660', field: 'creditScore' },
      { type: 'WARN', message: 'Stress TDS 46.3% exceeds 44% stress test guideline', field: 'stressTds' },
      { type: 'INFO', message: 'Condo fees $650/month included at 50% in GDS/TDS calculation', field: 'condoFees' },
    ],
  },
  incomeVerification: [
    { label: 'T4 Income (2023)', value: '$118,000', status: 'PASS' },
    { label: 'Employer (T4)', value: 'Accenture Canada Inc', status: 'PASS' },
    { label: 'Employer (Letter)', value: 'Accenture Inc — name mismatch', status: 'FAIL' },
    { label: 'Employment Length', value: '2 years', status: 'PASS' },
    { label: 'NOA Confirmation', value: 'Confirmed $118,000', status: 'PASS' },
  ],
  downPaymentVerification: {
    totalSubmitted: 174000,
    sourced: 174000,
    unexplained: 0,
    required: 53900,
  },
  documents: [
    {
      filename: 'T4 2023 — Accenture Canada Inc',
      detectedType: 'T4',
      status: 'GOOD',
      confidence: 0.95,
      keyDataExtracted: 'T4 2023 — Accenture Canada Inc — $118,000 employment income',
      extractedData: { year: 2023, employer: 'Accenture Canada Inc', employmentIncome: 118000 },
      issues: [],
    },
    {
      filename: 'Notice of Assessment 2023',
      detectedType: 'NOA',
      status: 'GOOD',
      confidence: 0.93,
      keyDataExtracted: 'NOA 2023 — total income $118,000 — assessed',
      extractedData: { year: 2023, totalIncome: 118000, balanceOwing: 0 },
      issues: [],
    },
    {
      filename: 'Bank Statement — 90 Days',
      detectedType: 'BANK_STATEMENT',
      status: 'GOOD',
      confidence: 0.92,
      keyDataExtracted: '90-day statement — closing balance $186,000 — no unexplained deposits',
      extractedData: { daysOfHistory: 90, closingBalance: 186000, unexplainedDeposits: 0 },
      issues: [],
    },
    {
      filename: 'Employment Letter — Accenture Inc (name mismatch)',
      detectedType: 'EMPLOYMENT_LETTER',
      status: 'REVIEW',
      confidence: 0.78,
      keyDataExtracted: "Employment letter — 'Accenture Inc' — does not match T4 employer name",
      extractedData: { employer: 'Accenture Inc', salary: 118000 },
      issues: ["Employer name 'Accenture Inc' does not match T4 entity 'Accenture Canada Inc' — clarification required"],
    },
  ],
  fraudSignals: [
    {
      id: 'FS-1',
      severity: 'MEDIUM',
      type: 'EMPLOYER_NAME_MISMATCH',
      evidence: "T4 shows 'Accenture Canada Inc' but employment letter shows 'Accenture Inc' — possible different legal entity",
      aiExplanation:
        'Minor employer name variation could indicate a different legal entity, subsidiary, or simple data entry error on the employment letter. The income amounts match across documents, which reduces fraud risk, but the entity name discrepancy must be resolved to satisfy lender requirements.',
      recommendation: 'Request updated employment letter on Accenture Canada Inc letterhead, matching the T4 employer entity name exactly',
      acknowledged: false,
    },
  ],
  aiAdvisory:
    "Benjamin Fontaine's file has one blocking issue and two risk factors that require resolution before submission. The employer name mismatch between the T4 ('Accenture Canada Inc') and employment letter ('Accenture Inc') is a medium-severity fraud signal — while likely innocent, no A-lender will accept this discrepancy. The fix is simple: request an updated employment letter on the correct entity letterhead.\n\nThe 641 beacon is borderline for A-lender approval. TD and Scotiabank both have discretionary approval pathways for beacons of 641-660, but this file will require strong compensating factors. The 22% down payment (78% LTV) and stable Ottawa market help, but stress TDS of 46.3% exceeding the 44% guideline is a material concern.\n\nOnce the employer letter is corrected: attempt TD or Scotiabank first at discretionary. If declined on beacon, pivot immediately to Home Trust B-lender — they accept 620+ beacon with higher TDS ratios.",
  recommendedDecision: 'MANUAL_REVIEW',
  recommendedConditions: [
    'Resolve employer name discrepancy — obtain updated employment letter on Accenture Canada Inc letterhead',
    'Provide 2 years T4 and NOA confirming $118,000 income',
    'Confirm closing costs of minimum $23,670 available',
    'Confirm no other monthly debt obligations not reflected in TDS',
  ],
  creditMemoHtml:
    '<h2>Credit Memo — Benjamin Fontaine</h2><p><strong>File:</strong> CL-0005 | <strong>Date:</strong> 2026-05-22 | <strong>Decision:</strong> MANUAL REVIEW</p><h3>Borrower</h3><p>Benjamin Fontaine — employed at Accenture Canada, 2 years. Credit: 641. Income: $118,000 T4.</p><h3>Property</h3><p>330 Wellington Street West, Ottawa ON — Condo — Purchase Price $789,000 — Down Payment $174,000 (22%) — Condo Fees $650/month.</p><h3>Ratios</h3><p>GDS: 36.2% | TDS: 39.8% | LTV: 78.0% | Stress TDS: 46.3% — Stress test exceeds 44% guideline.</p><h3>Fraud Signals</h3><p>1x MEDIUM — Employer name mismatch between T4 and employment letter.</p><h3>Recommendation</h3><p>Manual review required. Resolve employer name discrepancy before submission. Consider TD/Scotiabank discretionary or Home Trust B-lender.</p>',
};

// ─── Main seed function ───────────────────────────────────────────────────────

export async function main(targetTenantId = SEED_TENANT_ID, targetUserId = SEED_USER_ID) {
  console.log('Seeding ClearPath UW database (realistic demo data)...');

  // ── Tenant & demo user — only for the canonical seed tenant ─────────────────
  if (targetTenantId === SEED_TENANT_ID) {
    await prisma.tenant.upsert({
      where: { id: SEED_TENANT_ID },
      create: {
        id: SEED_TENANT_ID,
        name: 'ClearPath Demo',
        slug: 'demo',
        primaryColor: '#1B4332',
      },
      update: {
        name: 'ClearPath Demo',
        primaryColor: '#1B4332',
      },
    });

    await prisma.user.upsert({
      where: { id: SEED_USER_ID },
      create: {
        id: SEED_USER_ID,
        tenantId: SEED_TENANT_ID,
        clerkId: 'seed_clerk_id',
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@clearpath.ca',
        role: 'ADMIN',
      },
      update: {
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@clearpath.ca',
        role: 'ADMIN',
      },
    });
    console.log(`Tenant: ClearPath Demo (${targetTenantId}), User: demo@clearpath.ca`);
  }

  // File number prefix — unique per tenant so multiple seed runs don't conflict
  const filePrefix = targetTenantId === SEED_TENANT_ID
    ? 'CL'
    : targetTenantId.replace(/-/g, '').slice(0, 6).toUpperCase();

  // ── Application 1 — Sarah Chen — Purchase $549K Oakville — IN_REVIEW ────────
  const app1 = await prisma.application.upsert({
    where: { fileNumber: `${filePrefix}-0001` },
    create: {
      tenantId: targetTenantId,
      fileNumber: `${filePrefix}-0001`,
      status: 'IN_REVIEW',
      processingStatus: 'COMPLETE',
      dealIntelligenceReport: sarahChenDealIntelligence as unknown as Prisma.InputJsonValue,
      dealAnalyzedAt: new Date('2026-05-20T10:30:00Z'),
    },
    update: {
      status: 'IN_REVIEW',
      processingStatus: 'COMPLETE',
      dealIntelligenceReport: sarahChenDealIntelligence as unknown as Prisma.InputJsonValue,
    },
  });
  console.log(`Application 1: ${app1.fileNumber} — Sarah Chen (IN_REVIEW)`);

  // Borrower 1
  const existingBorrower1 = await prisma.borrower.findFirst({
    where: { applicationId: app1.id, type: 'PRIMARY' },
  });
  const borrower1 = existingBorrower1
    ? await prisma.borrower.update({
        where: { id: existingBorrower1.id },
        data: {
          firstName: 'Sarah',
          lastName: 'Chen',
          dob: new Date('1988-03-15'),
          email: 'sarah.chen@gmail.com',
          phone: '416-555-0101',
          sinEncrypted: '',
          employmentType: 'EMPLOYED',
          creditScore: 742,
        },
      })
    : await prisma.borrower.create({
        data: {
          applicationId: app1.id,
          type: 'PRIMARY',
          firstName: 'Sarah',
          lastName: 'Chen',
          dob: new Date('1988-03-15'),
          email: 'sarah.chen@gmail.com',
          phone: '416-555-0101',
          sinEncrypted: '',
          employmentType: 'EMPLOYED',
          creditScore: 742,
        },
      });

  await prisma.income.upsert({
    where: { borrowerId: borrower1.id },
    create: {
      borrowerId: borrower1.id,
      employerName: 'Deloitte Canada',
      yearsEmployed: new Prisma.Decimal(5),
      baseSalary: new Prisma.Decimal(112000),
    },
    update: {
      employerName: 'Deloitte Canada',
      yearsEmployed: new Prisma.Decimal(5),
      baseSalary: new Prisma.Decimal(112000),
    },
  });

  await prisma.property.upsert({
    where: { applicationId: app1.id },
    create: {
      applicationId: app1.id,
      address: '45 Maple Grove Drive',
      city: 'Oakville',
      province: 'ON',
      postalCode: 'L6J 3K9',
      propertyType: 'DETACHED',
      occupancy: 'OWNER',
      purchasePrice: new Prisma.Decimal(549000),
      appraisedValue: new Prisma.Decimal(549000),
      downPayment: new Prisma.Decimal(109800),
      annualTax: new Prisma.Decimal(5800),
      monthlyHeat: new Prisma.Decimal(200),
    },
    update: {
      address: '45 Maple Grove Drive',
      city: 'Oakville',
      purchasePrice: new Prisma.Decimal(549000),
      downPayment: new Prisma.Decimal(109800),
    },
  });

  await prisma.mortgageTerms.upsert({
    where: { applicationId: app1.id },
    create: {
      applicationId: app1.id,
      contractRate: new Prisma.Decimal(5.49),
      stressRate: new Prisma.Decimal(7.49),
      amortizationYears: 25,
      termYears: 5,
      insured: false,
      monthlyPayment: new Prisma.Decimal(2609.22),
      mortgageAmount: new Prisma.Decimal(439200),
    },
    update: {
      contractRate: new Prisma.Decimal(5.49),
      amortizationYears: 25,
    },
  });

  // Documents for App 1
  const docs1 = [
    { name: 'T4 2023 — Deloitte Canada', type: 'T4' as const, status: 'APPROVED' as const },
    { name: 'Notice of Assessment 2023', type: 'NOA' as const, status: 'APPROVED' as const },
    { name: 'Bank Statement — 93 Days', type: 'BANK_STATEMENT' as const, status: 'APPROVED' as const },
    { name: 'Government Photo ID', type: 'ID' as const, status: 'APPROVED' as const },
  ];
  for (const doc of docs1) {
    const existing = await prisma.document.findFirst({
      where: { applicationId: app1.id, name: doc.name },
    });
    if (!existing) {
      await prisma.document.create({
        data: {
          applicationId: app1.id,
          uploadedById: targetUserId,
          name: doc.name,
          type: doc.type,
          s3Key: PLACEHOLDER_S3,
          url: PLACEHOLDER_URL,
          status: doc.status,
        },
      });
    }
  }

  // ── Application 2 — Derek & Aisha Tran — Purchase $720K Barrie — DRAFT ──────
  const app2 = await prisma.application.upsert({
    where: { fileNumber: `${filePrefix}-0002` },
    create: {
      tenantId: targetTenantId,
      fileNumber: `${filePrefix}-0002`,
      status: 'DRAFT',
      processingStatus: 'COMPLETE',
      dealIntelligenceReport: derekAishaDealIntelligence as unknown as Prisma.InputJsonValue,
      dealAnalyzedAt: new Date('2026-05-21T09:15:00Z'),
    },
    update: {
      status: 'DRAFT',
      processingStatus: 'COMPLETE',
      dealIntelligenceReport: derekAishaDealIntelligence as unknown as Prisma.InputJsonValue,
    },
  });
  console.log(`Application 2: ${app2.fileNumber} — Derek & Aisha Tran (DRAFT)`);

  // Primary borrower — Derek
  const existingDerek = await prisma.borrower.findFirst({
    where: { applicationId: app2.id, type: 'PRIMARY' },
  });
  const derekBorrower = existingDerek
    ? await prisma.borrower.update({
        where: { id: existingDerek.id },
        data: {
          firstName: 'Derek',
          lastName: 'Tran',
          dob: new Date('1985-07-22'),
          email: 'derek.tran@gmail.com',
          phone: '705-555-0122',
          sinEncrypted: '',
          employmentType: 'EMPLOYED',
          creditScore: 681,
        },
      })
    : await prisma.borrower.create({
        data: {
          applicationId: app2.id,
          type: 'PRIMARY',
          firstName: 'Derek',
          lastName: 'Tran',
          dob: new Date('1985-07-22'),
          email: 'derek.tran@gmail.com',
          phone: '705-555-0122',
          sinEncrypted: '',
          employmentType: 'EMPLOYED',
          creditScore: 681,
        },
      });

  await prisma.income.upsert({
    where: { borrowerId: derekBorrower.id },
    create: {
      borrowerId: derekBorrower.id,
      employerName: 'Ontario Government',
      yearsEmployed: new Prisma.Decimal(8),
      baseSalary: new Prisma.Decimal(95000),
    },
    update: {
      employerName: 'Ontario Government',
      yearsEmployed: new Prisma.Decimal(8),
      baseSalary: new Prisma.Decimal(95000),
    },
  });

  // Co-borrower — Aisha
  const existingAisha = await prisma.borrower.findFirst({
    where: { applicationId: app2.id, type: 'CO_BORROWER' },
  });
  const aishaBorrower = existingAisha
    ? await prisma.borrower.update({
        where: { id: existingAisha.id },
        data: {
          firstName: 'Aisha',
          lastName: 'Tran',
          dob: new Date('1987-11-30'),
          email: 'aisha.tran@gmail.com',
          phone: '705-555-0133',
          sinEncrypted: '',
          employmentType: 'EMPLOYED',
          creditScore: 698,
        },
      })
    : await prisma.borrower.create({
        data: {
          applicationId: app2.id,
          type: 'CO_BORROWER',
          firstName: 'Aisha',
          lastName: 'Tran',
          dob: new Date('1987-11-30'),
          email: 'aisha.tran@gmail.com',
          phone: '705-555-0133',
          sinEncrypted: '',
          employmentType: 'EMPLOYED',
          creditScore: 698,
        },
      });

  await prisma.income.upsert({
    where: { borrowerId: aishaBorrower.id },
    create: {
      borrowerId: aishaBorrower.id,
      employerName: 'RBC Royal Bank',
      yearsEmployed: new Prisma.Decimal(3),
      baseSalary: new Prisma.Decimal(78000),
    },
    update: {
      employerName: 'RBC Royal Bank',
      yearsEmployed: new Prisma.Decimal(3),
      baseSalary: new Prisma.Decimal(78000),
    },
  });

  await prisma.property.upsert({
    where: { applicationId: app2.id },
    create: {
      applicationId: app2.id,
      address: '182 Sundown Crescent',
      city: 'Barrie',
      province: 'ON',
      postalCode: 'L4N 7R2',
      propertyType: 'DETACHED',
      occupancy: 'OWNER',
      purchasePrice: new Prisma.Decimal(720000),
      appraisedValue: new Prisma.Decimal(720000),
      downPayment: new Prisma.Decimal(108000),
      annualTax: new Prisma.Decimal(6200),
      monthlyHeat: new Prisma.Decimal(220),
    },
    update: {
      address: '182 Sundown Crescent',
      city: 'Barrie',
      purchasePrice: new Prisma.Decimal(720000),
      downPayment: new Prisma.Decimal(108000),
    },
  });

  await prisma.mortgageTerms.upsert({
    where: { applicationId: app2.id },
    create: {
      applicationId: app2.id,
      contractRate: new Prisma.Decimal(5.74),
      stressRate: new Prisma.Decimal(7.74),
      amortizationYears: 25,
      termYears: 5,
      insured: true,
      monthlyPayment: new Prisma.Decimal(3682.11),
      mortgageAmount: new Prisma.Decimal(612000),
    },
    update: {
      contractRate: new Prisma.Decimal(5.74),
      amortizationYears: 25,
    },
  });

  const docs2 = [
    { name: 'T4 2023 — Ontario Government (Derek)', type: 'T4' as const, status: 'APPROVED' as const },
    { name: 'T4 2023 — RBC Royal Bank (Aisha)', type: 'T4' as const, status: 'APPROVED' as const },
    { name: 'Notice of Assessment 2023', type: 'NOA' as const, status: 'APPROVED' as const },
    { name: 'Bank Statement — 87 Days (incomplete)', type: 'BANK_STATEMENT' as const, status: 'PENDING' as const },
  ];
  for (const doc of docs2) {
    const existing = await prisma.document.findFirst({
      where: { applicationId: app2.id, name: doc.name },
    });
    if (!existing) {
      await prisma.document.create({
        data: {
          applicationId: app2.id,
          uploadedById: targetUserId,
          name: doc.name,
          type: doc.type,
          s3Key: PLACEHOLDER_S3,
          url: PLACEHOLDER_URL,
          status: doc.status,
        },
      });
    }
  }

  // ── Application 3 — Marcus Webb — Refinance $380K Hamilton — CONDITIONALLY_APPROVED ──
  const app3 = await prisma.application.upsert({
    where: { fileNumber: `${filePrefix}-0003` },
    create: {
      tenantId: targetTenantId,
      fileNumber: `${filePrefix}-0003`,
      status: 'CONDITIONALLY_APPROVED',
      processingStatus: 'COMPLETE',
      dealIntelligenceReport: marcusWebbDealIntelligence as unknown as Prisma.InputJsonValue,
      dealAnalyzedAt: new Date('2026-05-19T14:00:00Z'),
    },
    update: {
      status: 'CONDITIONALLY_APPROVED',
      processingStatus: 'COMPLETE',
      dealIntelligenceReport: marcusWebbDealIntelligence as unknown as Prisma.InputJsonValue,
    },
  });
  console.log(`Application 3: ${app3.fileNumber} — Marcus Webb (CONDITIONALLY_APPROVED)`);

  const existingMarcus = await prisma.borrower.findFirst({
    where: { applicationId: app3.id, type: 'PRIMARY' },
  });
  const marcusBorrower = existingMarcus
    ? await prisma.borrower.update({
        where: { id: existingMarcus.id },
        data: {
          firstName: 'Marcus',
          lastName: 'Webb',
          dob: new Date('1979-09-03'),
          email: 'marcus.webb@hotmail.com',
          phone: '905-555-0177',
          sinEncrypted: '',
          employmentType: 'SELF_EMPLOYED',
          creditScore: 728,
        },
      })
    : await prisma.borrower.create({
        data: {
          applicationId: app3.id,
          type: 'PRIMARY',
          firstName: 'Marcus',
          lastName: 'Webb',
          dob: new Date('1979-09-03'),
          email: 'marcus.webb@hotmail.com',
          phone: '905-555-0177',
          sinEncrypted: '',
          employmentType: 'SELF_EMPLOYED',
          creditScore: 728,
        },
      });

  await prisma.income.upsert({
    where: { borrowerId: marcusBorrower.id },
    create: {
      borrowerId: marcusBorrower.id,
      employerName: 'Webb Financial Services',
      yearsEmployed: new Prisma.Decimal(7),
      baseSalary: new Prisma.Decimal(148000),
    },
    update: {
      employerName: 'Webb Financial Services',
      yearsEmployed: new Prisma.Decimal(7),
      baseSalary: new Prisma.Decimal(148000),
    },
  });

  await prisma.property.upsert({
    where: { applicationId: app3.id },
    create: {
      applicationId: app3.id,
      address: '29 Heritage Hill Road',
      city: 'Hamilton',
      province: 'ON',
      postalCode: 'L8P 2M4',
      propertyType: 'DETACHED',
      occupancy: 'OWNER',
      purchasePrice: new Prisma.Decimal(620000),
      appraisedValue: new Prisma.Decimal(620000),
      downPayment: new Prisma.Decimal(240000),
      annualTax: new Prisma.Decimal(5200),
      monthlyHeat: new Prisma.Decimal(180),
    },
    update: {
      address: '29 Heritage Hill Road',
      city: 'Hamilton',
      purchasePrice: new Prisma.Decimal(620000),
    },
  });

  await prisma.mortgageTerms.upsert({
    where: { applicationId: app3.id },
    create: {
      applicationId: app3.id,
      contractRate: new Prisma.Decimal(5.29),
      stressRate: new Prisma.Decimal(7.29),
      amortizationYears: 20,
      termYears: 3,
      insured: false,
      monthlyPayment: new Prisma.Decimal(2421.30),
      mortgageAmount: new Prisma.Decimal(380000),
    },
    update: {
      contractRate: new Prisma.Decimal(5.29),
      amortizationYears: 20,
    },
  });

  const docs3 = [
    { name: 'T4 2023 — Webb Financial Services', type: 'T4' as const, status: 'APPROVED' as const },
    { name: 'Notice of Assessment 2023', type: 'NOA' as const, status: 'APPROVED' as const },
    { name: 'Bank Statement — 95 Days', type: 'BANK_STATEMENT' as const, status: 'APPROVED' as const },
    { name: 'Government Photo ID', type: 'ID' as const, status: 'APPROVED' as const },
    { name: 'Property Appraisal — $620,000', type: 'APPRAISAL' as const, status: 'APPROVED' as const },
  ];
  for (const doc of docs3) {
    const existing = await prisma.document.findFirst({
      where: { applicationId: app3.id, name: doc.name },
    });
    if (!existing) {
      await prisma.document.create({
        data: {
          applicationId: app3.id,
          uploadedById: targetUserId,
          name: doc.name,
          type: doc.type,
          s3Key: PLACEHOLDER_S3,
          url: PLACEHOLDER_URL,
          status: doc.status,
        },
      });
    }
  }

  // ── Application 4 — Jerome Okonkwo — Purchase $615K Toronto — APPROVED ───────
  const app4 = await prisma.application.upsert({
    where: { fileNumber: `${filePrefix}-0004` },
    create: {
      tenantId: targetTenantId,
      fileNumber: `${filePrefix}-0004`,
      status: 'APPROVED',
      processingStatus: 'COMPLETE',
      dealReviewReport: okonkwoDealReview as unknown as Prisma.InputJsonValue,
      dealAnalyzedAt: new Date('2026-05-18T11:00:00Z'),
    },
    update: {
      status: 'APPROVED',
      processingStatus: 'COMPLETE',
      dealReviewReport: okonkwoDealReview as unknown as Prisma.InputJsonValue,
    },
  });
  console.log(`Application 4: ${app4.fileNumber} — Jerome Okonkwo (APPROVED)`);

  const existingJerome = await prisma.borrower.findFirst({
    where: { applicationId: app4.id, type: 'PRIMARY' },
  });
  const jeromeBorrower = existingJerome
    ? await prisma.borrower.update({
        where: { id: existingJerome.id },
        data: {
          firstName: 'Jerome',
          lastName: 'Okonkwo',
          dob: new Date('1982-04-14'),
          email: 'jerome.okonkwo@gmail.com',
          phone: '416-555-0144',
          sinEncrypted: '',
          employmentType: 'EMPLOYED',
          creditScore: 774,
        },
      })
    : await prisma.borrower.create({
        data: {
          applicationId: app4.id,
          type: 'PRIMARY',
          firstName: 'Jerome',
          lastName: 'Okonkwo',
          dob: new Date('1982-04-14'),
          email: 'jerome.okonkwo@gmail.com',
          phone: '416-555-0144',
          sinEncrypted: '',
          employmentType: 'EMPLOYED',
          creditScore: 774,
        },
      });

  await prisma.income.upsert({
    where: { borrowerId: jeromeBorrower.id },
    create: {
      borrowerId: jeromeBorrower.id,
      employerName: 'TD Bank',
      yearsEmployed: new Prisma.Decimal(6),
      baseSalary: new Prisma.Decimal(131000),
    },
    update: {
      employerName: 'TD Bank',
      yearsEmployed: new Prisma.Decimal(6),
      baseSalary: new Prisma.Decimal(131000),
    },
  });

  await prisma.property.upsert({
    where: { applicationId: app4.id },
    create: {
      applicationId: app4.id,
      address: '88 Lakeview Avenue',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M6K 1T3',
      propertyType: 'SEMI',
      occupancy: 'OWNER',
      purchasePrice: new Prisma.Decimal(615000),
      appraisedValue: new Prisma.Decimal(615000),
      downPayment: new Prisma.Decimal(203000),
      annualTax: new Prisma.Decimal(7400),
      monthlyHeat: new Prisma.Decimal(160),
    },
    update: {
      address: '88 Lakeview Avenue',
      city: 'Toronto',
      purchasePrice: new Prisma.Decimal(615000),
    },
  });

  await prisma.mortgageTerms.upsert({
    where: { applicationId: app4.id },
    create: {
      applicationId: app4.id,
      contractRate: new Prisma.Decimal(5.59),
      stressRate: new Prisma.Decimal(7.59),
      amortizationYears: 25,
      termYears: 5,
      insured: false,
      monthlyPayment: new Prisma.Decimal(2484.60),
      mortgageAmount: new Prisma.Decimal(412000),
    },
    update: {
      contractRate: new Prisma.Decimal(5.59),
      amortizationYears: 25,
    },
  });

  const docs4 = [
    { name: 'T4 2023 — TD Bank', type: 'T4' as const, status: 'APPROVED' as const },
    { name: 'Notice of Assessment 2023', type: 'NOA' as const, status: 'APPROVED' as const },
    { name: 'Bank Statement — 90 Days', type: 'BANK_STATEMENT' as const, status: 'APPROVED' as const },
    { name: 'Government Photo ID', type: 'ID' as const, status: 'APPROVED' as const },
    { name: 'Employment Letter — TD Bank', type: 'OTHER' as const, status: 'APPROVED' as const },
  ];
  for (const doc of docs4) {
    const existing = await prisma.document.findFirst({
      where: { applicationId: app4.id, name: doc.name },
    });
    if (!existing) {
      await prisma.document.create({
        data: {
          applicationId: app4.id,
          uploadedById: targetUserId,
          name: doc.name,
          type: doc.type,
          s3Key: PLACEHOLDER_S3,
          url: PLACEHOLDER_URL,
          status: doc.status,
        },
      });
    }
  }

  // Underwriting decision for App 4
  const existingDecision4 = await prisma.underwritingDecision.findFirst({
    where: { applicationId: app4.id },
  });
  if (!existingDecision4) {
    await prisma.underwritingDecision.create({
      data: {
        applicationId: app4.id,
        gds: new Prisma.Decimal(28.4),
        tds: new Prisma.Decimal(28.4),
        ltv: new Prisma.Decimal(67.0),
        stressGds: new Prisma.Decimal(33.8),
        stressTds: new Prisma.Decimal(33.8),
        decision: 'APPROVE',
        flags: [
          { type: 'PASS', message: '774 beacon — top-tier credit', field: 'creditScore' },
          { type: 'PASS', message: 'GDS 28.4% — well within 39% limit', field: 'gds' },
          { type: 'PASS', message: '33% down payment — conventional mortgage', field: 'ltv' },
        ],
        notes: 'Clean A-lender file. All documentation verified. No exceptions required.',
        decidedById: targetUserId,
      },
    });
  }

  // ── Application 5 — Benjamin Fontaine — Purchase $789K Ottawa — IN_REVIEW ───
  const app5 = await prisma.application.upsert({
    where: { fileNumber: `${filePrefix}-0005` },
    create: {
      tenantId: targetTenantId,
      fileNumber: `${filePrefix}-0005`,
      status: 'IN_REVIEW',
      processingStatus: 'COMPLETE',
      dealReviewReport: fontaineDealReview as unknown as Prisma.InputJsonValue,
      dealAnalyzedAt: new Date('2026-05-22T08:45:00Z'),
    },
    update: {
      status: 'IN_REVIEW',
      processingStatus: 'COMPLETE',
      dealReviewReport: fontaineDealReview as unknown as Prisma.InputJsonValue,
    },
  });
  console.log(`Application 5: ${app5.fileNumber} — Benjamin Fontaine (IN_REVIEW)`);

  const existingBenjamin = await prisma.borrower.findFirst({
    where: { applicationId: app5.id, type: 'PRIMARY' },
  });
  const benjaminBorrower = existingBenjamin
    ? await prisma.borrower.update({
        where: { id: existingBenjamin.id },
        data: {
          firstName: 'Benjamin',
          lastName: 'Fontaine',
          dob: new Date('1991-06-18'),
          email: 'benjamin.fontaine@gmail.com',
          phone: '613-555-0155',
          sinEncrypted: '',
          employmentType: 'EMPLOYED',
          creditScore: 641,
        },
      })
    : await prisma.borrower.create({
        data: {
          applicationId: app5.id,
          type: 'PRIMARY',
          firstName: 'Benjamin',
          lastName: 'Fontaine',
          dob: new Date('1991-06-18'),
          email: 'benjamin.fontaine@gmail.com',
          phone: '613-555-0155',
          sinEncrypted: '',
          employmentType: 'EMPLOYED',
          creditScore: 641,
        },
      });

  await prisma.income.upsert({
    where: { borrowerId: benjaminBorrower.id },
    create: {
      borrowerId: benjaminBorrower.id,
      employerName: 'Accenture Canada',
      yearsEmployed: new Prisma.Decimal(2),
      baseSalary: new Prisma.Decimal(118000),
    },
    update: {
      employerName: 'Accenture Canada',
      yearsEmployed: new Prisma.Decimal(2),
      baseSalary: new Prisma.Decimal(118000),
    },
  });

  await prisma.property.upsert({
    where: { applicationId: app5.id },
    create: {
      applicationId: app5.id,
      address: '330 Wellington Street West',
      city: 'Ottawa',
      province: 'ON',
      postalCode: 'K1R 7S8',
      propertyType: 'CONDO',
      occupancy: 'OWNER',
      purchasePrice: new Prisma.Decimal(789000),
      appraisedValue: new Prisma.Decimal(789000),
      downPayment: new Prisma.Decimal(174000),
      annualTax: new Prisma.Decimal(7100),
      monthlyHeat: new Prisma.Decimal(120),
      condoFees: new Prisma.Decimal(650),
    },
    update: {
      address: '330 Wellington Street West',
      city: 'Ottawa',
      purchasePrice: new Prisma.Decimal(789000),
    },
  });

  await prisma.mortgageTerms.upsert({
    where: { applicationId: app5.id },
    create: {
      applicationId: app5.id,
      contractRate: new Prisma.Decimal(5.84),
      stressRate: new Prisma.Decimal(7.84),
      amortizationYears: 25,
      termYears: 5,
      insured: false,
      monthlyPayment: new Prisma.Decimal(3820.10),
      mortgageAmount: new Prisma.Decimal(615000),
    },
    update: {
      contractRate: new Prisma.Decimal(5.84),
      amortizationYears: 25,
    },
  });

  const docs5 = [
    { name: "T4 2023 — Accenture Canada Inc", type: 'T4' as const, status: 'APPROVED' as const },
    { name: 'Notice of Assessment 2023', type: 'NOA' as const, status: 'APPROVED' as const },
    { name: 'Bank Statement — 90 Days', type: 'BANK_STATEMENT' as const, status: 'APPROVED' as const },
    { name: 'Employment Letter — Accenture Inc (name mismatch)', type: 'OTHER' as const, status: 'REVIEWED' as const },
  ];
  for (const doc of docs5) {
    const existing = await prisma.document.findFirst({
      where: { applicationId: app5.id, name: doc.name },
    });
    if (!existing) {
      await prisma.document.create({
        data: {
          applicationId: app5.id,
          uploadedById: targetUserId,
          name: doc.name,
          type: doc.type,
          s3Key: PLACEHOLDER_S3,
          url: PLACEHOLDER_URL,
          status: doc.status,
        },
      });
    }
  }

  // Underwriting decision for App 5 (MANUAL_REVIEW)
  const existingDecision5 = await prisma.underwritingDecision.findFirst({
    where: { applicationId: app5.id },
  });
  if (!existingDecision5) {
    await prisma.underwritingDecision.create({
      data: {
        applicationId: app5.id,
        gds: new Prisma.Decimal(36.2),
        tds: new Prisma.Decimal(39.8),
        ltv: new Prisma.Decimal(78.0),
        stressGds: new Prisma.Decimal(42.1),
        stressTds: new Prisma.Decimal(46.3),
        decision: 'MANUAL_REVIEW',
        flags: [
          {
            type: 'WARN',
            message: "Employer name mismatch — T4 shows 'Accenture Canada Inc' vs employment letter 'Accenture Inc'",
            field: 'employment',
          },
          { type: 'WARN', message: '641 beacon — borderline A-lender threshold', field: 'creditScore' },
          { type: 'WARN', message: 'Stress test TDS 46.3% exceeds 44% guideline', field: 'stressTds' },
        ],
        notes:
          'Manual review required. Employer name discrepancy must be resolved. Stress test TDS exceeds guideline — may require B-lender channel.',
        decidedById: targetUserId,
      },
    });
  }

  console.log('\nSeed complete.');
  console.log(`  Tenant ID: ${targetTenantId}`);
  console.log(`  User ID:   ${targetUserId}`);
  console.log(`  App 1:     CL-0001 — Sarah Chen — Purchase $549K Oakville — IN_REVIEW (score 88)`);
  console.log(`  App 2:     CL-0002 — Derek & Aisha Tran — Purchase $720K Barrie — DRAFT (score 61)`);
  console.log(`  App 3:     CL-0003 — Marcus Webb — Refinance $380K Hamilton — CONDITIONALLY_APPROVED (score 94)`);
  console.log(`  App 4:     CL-0004 — Jerome Okonkwo — Purchase $412K Toronto — APPROVED (quality 91)`);
  console.log(`  App 5:     CL-0005 — Benjamin Fontaine — Purchase $615K Ottawa — IN_REVIEW (quality 67, fraud signal)`);
}

// Only self-execute when run directly (tsx src/prisma/seed.ts), not when imported
const argv1 = process.argv[1] ?? '';
if (argv1.endsWith('seed.ts') || argv1.endsWith('seed.js')) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
