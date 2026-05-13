import Decimal from 'decimal.js';

// ─── Input/Output types ───────────────────────────────────────────────────────

export interface IncomeInput {
  baseSalary: number;
  bonus: number;
  overtime: number;
  otherIncome: number;
  selfEmployedAvg: number | null;
  rentalIncome: number;
  yearsEmployed: number | null;
  employmentType: 'EMPLOYED' | 'SELF_EMPLOYED' | 'CONTRACT' | 'RETIRED' | 'OTHER';
  coIncome?: {
    baseSalary: number;
    bonus: number;
    overtime: number;
    otherIncome: number;
    selfEmployedAvg: number | null;
    rentalIncome: number;
    yearsEmployed: number | null;
    employmentType: string;
  };
}

export interface PropertyInput {
  purchasePrice: number;
  appraisedValue: number;
  downPayment: number;
  annualTax: number;
  monthlyHeat: number;
  condoFees: number;
}

export interface TermsInput {
  contractRate: number;
  amortizationYears: number;
  insured: boolean;
}

export interface BorrowerInput {
  creditScore: number;
  bankruptcies: boolean;
  collections: boolean;
  employmentType: string;
  existingMortgages: number;
  yearsEmployed: number | null;
}

export interface UWFlag {
  type: 'PASS' | 'WARN' | 'FAIL' | 'INFO';
  message: string;
  field?: string;
}

export interface UWResult {
  monthlyIncome: number;
  mortgageAmount: number;
  monthlyPayment: number;
  stressPayment: number;
  gds: number;
  tds: number;
  ltv: number;
  stressGds: number;
  stressTds: number;
  stressRate: number;
  flags: UWFlag[];
  decision: 'APPROVE' | 'MANUAL_REVIEW' | 'DECLINE';
  qualifyingIncome: {
    baseSalary: number;
    bonus: number;
    overtime: number;
    otherIncome: number;
    selfEmployed: number;
    rental: number;
    coApplicant: number;
    total: number;
  };
}

// ─── Core calculations ────────────────────────────────────────────────────────

/**
 * Standard amortizing mortgage monthly payment.
 * P * r(1+r)^n / ((1+r)^n - 1)
 * where r = annualRate/100/12, n = amortYears*12
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  amortYears: number
): number {
  const P = new Decimal(principal);
  const r = new Decimal(annualRate).div(100).div(12);
  const n = new Decimal(amortYears).mul(12);

  if (r.isZero()) {
    // Zero-interest edge case
    return P.div(n).toNumber();
  }

  // (1 + r)^n
  const onePlusR = r.plus(1);
  const onePlusRn = onePlusR.pow(n);

  // P * r * (1+r)^n / ((1+r)^n - 1)
  const payment = P.mul(r).mul(onePlusRn).div(onePlusRn.minus(1));
  return payment.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

// ─── Income qualification ─────────────────────────────────────────────────────

interface QualifiedIncomeParts {
  baseSalary: number;
  bonus: number;
  overtime: number;
  otherIncome: number;
  selfEmployed: number;
  rental: number;
}

function qualifyIncome(
  income: {
    baseSalary: number;
    bonus: number;
    overtime: number;
    otherIncome: number;
    selfEmployedAvg: number | null;
    rentalIncome: number;
    yearsEmployed: number | null;
  },
  employmentType: string
): QualifiedIncomeParts {
  const yrs = income.yearsEmployed ?? 0;

  let baseSalary = 0;
  let bonus = 0;
  let overtime = 0;
  let otherIncome = 0;
  let selfEmployed = 0;

  switch (employmentType) {
    case 'EMPLOYED': {
      baseSalary = income.baseSalary;
      bonus = yrs >= 2 ? income.bonus : 0;
      overtime = yrs >= 2 ? income.overtime : 0;
      otherIncome = income.otherIncome;
      break;
    }
    case 'SELF_EMPLOYED': {
      selfEmployed = income.selfEmployedAvg ?? 0;
      otherIncome = income.otherIncome;
      break;
    }
    case 'CONTRACT': {
      baseSalary = income.baseSalary;
      otherIncome = income.otherIncome;
      break;
    }
    case 'RETIRED':
    case 'OTHER': {
      otherIncome = income.otherIncome;
      break;
    }
    default: {
      otherIncome = income.otherIncome;
    }
  }

  // Rental income always qualifies at 50%
  const rental = new Decimal(income.rentalIncome).mul(0.5).toNumber();

  return { baseSalary, bonus, overtime, otherIncome, selfEmployed, rental };
}

// ─── Flag generation ──────────────────────────────────────────────────────────

function generateFlags(
  gds: number,
  tds: number,
  ltv: number,
  stressGds: number,
  stressTds: number,
  borrower: BorrowerInput,
  property: PropertyInput
): UWFlag[] {
  const flags: UWFlag[] = [];

  // ── LTV ──────────────────────────────────────────────────────────────────
  if (ltv > 95) {
    flags.push({ type: 'FAIL', message: 'LTV exceeds 95% insured maximum', field: 'ltv' });
  } else if (ltv > 80 && ltv <= 95) {
    flags.push({ type: 'WARN', message: 'CMHC insurance required', field: 'ltv' });
  }

  // ── GDS ──────────────────────────────────────────────────────────────────
  if (gds > 39) {
    flags.push({ type: 'FAIL', message: 'GDS exceeds hard cap of 39%', field: 'gds' });
  } else if (gds > 35 && gds <= 39) {
    flags.push({ type: 'WARN', message: 'GDS above guideline target of 35%', field: 'gds' });
  }

  // ── TDS ──────────────────────────────────────────────────────────────────
  if (tds > 44) {
    flags.push({ type: 'FAIL', message: 'TDS exceeds hard cap of 44%', field: 'tds' });
  } else if (tds > 40 && tds <= 44) {
    flags.push({ type: 'WARN', message: 'TDS above guideline target of 40%', field: 'tds' });
  }

  // ── Stress test ───────────────────────────────────────────────────────────
  if (stressGds > 39) {
    flags.push({ type: 'WARN', message: 'File fails stress test on GDS', field: 'stressGds' });
  }
  if (stressTds > 44) {
    flags.push({ type: 'WARN', message: 'File fails stress test on TDS', field: 'stressTds' });
  }

  // ── Credit score ──────────────────────────────────────────────────────────
  if (borrower.creditScore < 600) {
    flags.push({
      type: 'FAIL',
      message: 'Credit score below minimum threshold',
      field: 'creditScore',
    });
  } else if (borrower.creditScore >= 600 && borrower.creditScore < 660) {
    flags.push({
      type: 'WARN',
      message: 'Credit score in alternative lender range',
      field: 'creditScore',
    });
  } else if (borrower.creditScore >= 720) {
    flags.push({ type: 'PASS', message: 'Strong credit profile', field: 'creditScore' });
  }

  // ── Bankruptcies / collections ────────────────────────────────────────────
  if (borrower.bankruptcies) {
    flags.push({
      type: 'FAIL',
      message: 'Bankruptcy on file — manual review required',
      field: 'bankruptcies',
    });
  }
  if (borrower.collections) {
    flags.push({
      type: 'WARN',
      message: 'Collections present — verify and clear',
      field: 'collections',
    });
  }

  // ── Down payment ──────────────────────────────────────────────────────────
  const minDown = new Decimal(property.purchasePrice).mul(0.05).toNumber();
  const conventionalThreshold = new Decimal(property.purchasePrice).mul(0.2).toNumber();

  if (property.downPayment < minDown) {
    flags.push({
      type: 'FAIL',
      message: 'Down payment below 5% statutory minimum',
      field: 'downPayment',
    });
  } else if (property.downPayment >= conventionalThreshold) {
    flags.push({
      type: 'PASS',
      message: 'Conventional mortgage — no default insurance required',
      field: 'downPayment',
    });
  }

  // ── Employment ────────────────────────────────────────────────────────────
  if (
    borrower.employmentType === 'SELF_EMPLOYED' &&
    (borrower.yearsEmployed === null || borrower.yearsEmployed < 2)
  ) {
    flags.push({
      type: 'WARN',
      message: 'Self-employed less than 2 years — NOA verification required',
      field: 'yearsEmployed',
    });
  }

  // ── Existing mortgages ────────────────────────────────────────────────────
  if (borrower.existingMortgages > 1) {
    flags.push({
      type: 'WARN',
      message:
        'Multiple existing properties — rental income and obligations require verification',
      field: 'existingMortgages',
    });
  }

  return flags;
}

// ─── Main underwrite function ─────────────────────────────────────────────────

export function underwrite(
  income: IncomeInput,
  property: PropertyInput,
  terms: TermsInput,
  borrower: BorrowerInput
): UWResult {
  // ── Qualifying income — primary borrower ──────────────────────────────────
  const primaryParts = qualifyIncome(income, income.employmentType);

  const primaryTotal = new Decimal(primaryParts.baseSalary)
    .plus(primaryParts.bonus)
    .plus(primaryParts.overtime)
    .plus(primaryParts.otherIncome)
    .plus(primaryParts.selfEmployed)
    .plus(primaryParts.rental);

  // ── Qualifying income — co-applicant ──────────────────────────────────────
  let coApplicantTotal = new Decimal(0);
  if (income.coIncome) {
    const coParts = qualifyIncome(income.coIncome, income.coIncome.employmentType);
    coApplicantTotal = new Decimal(coParts.baseSalary)
      .plus(coParts.bonus)
      .plus(coParts.overtime)
      .plus(coParts.otherIncome)
      .plus(coParts.selfEmployed)
      .plus(coParts.rental);
  }

  const totalQualifyingIncome = primaryTotal.plus(coApplicantTotal);
  const monthlyIncome = totalQualifyingIncome.div(12);

  // ── Stress rate ───────────────────────────────────────────────────────────
  const stressRate = Math.max(terms.contractRate + 2, 5.25);

  // ── Mortgage amount ───────────────────────────────────────────────────────
  const mortgageAmount = new Decimal(property.purchasePrice)
    .minus(property.downPayment)
    .toDecimalPlaces(2);

  // ── Monthly payments ──────────────────────────────────────────────────────
  const monthlyPayment = calculateMonthlyPayment(
    mortgageAmount.toNumber(),
    terms.contractRate,
    terms.amortizationYears
  );
  const stressPayment = calculateMonthlyPayment(
    mortgageAmount.toNumber(),
    stressRate,
    terms.amortizationYears
  );

  // ── Housing costs ─────────────────────────────────────────────────────────
  const monthlyTax = new Decimal(property.annualTax).div(12);
  const monthlyHeat = new Decimal(property.monthlyHeat);
  // CMHC: 50% of condo fees count in ratios
  const monthlyCondoFees = new Decimal(property.condoFees).mul(0.5);

  // ── GDS / TDS ────────────────────────────────────────────────────────────
  // GDS = (P&I + tax/12 + heat + 50% condo) / monthlyIncome * 100
  // TDS = same housing costs (other obligations = 0 for now, structure ready)
  const otherMonthlyObligations = new Decimal(0); // placeholder — future: debt payments

  const housingCosts = new Decimal(monthlyPayment)
    .plus(monthlyTax)
    .plus(monthlyHeat)
    .plus(monthlyCondoFees);

  const stressHousingCosts = new Decimal(stressPayment)
    .plus(monthlyTax)
    .plus(monthlyHeat)
    .plus(monthlyCondoFees);

  const totalObligations = housingCosts.plus(otherMonthlyObligations);
  const stressTotalObligations = stressHousingCosts.plus(otherMonthlyObligations);

  let gds = 0;
  let tds = 0;
  let stressGds = 0;
  let stressTds = 0;

  if (!monthlyIncome.isZero()) {
    gds = housingCosts.div(monthlyIncome).mul(100).toDecimalPlaces(3).toNumber();
    tds = totalObligations.div(monthlyIncome).mul(100).toDecimalPlaces(3).toNumber();
    stressGds = stressHousingCosts
      .div(monthlyIncome)
      .mul(100)
      .toDecimalPlaces(3)
      .toNumber();
    stressTds = stressTotalObligations
      .div(monthlyIncome)
      .mul(100)
      .toDecimalPlaces(3)
      .toNumber();
  }

  // ── LTV ───────────────────────────────────────────────────────────────────
  const valuationBase = Math.min(property.purchasePrice, property.appraisedValue);
  const ltv = new Decimal(mortgageAmount)
    .div(valuationBase)
    .mul(100)
    .toDecimalPlaces(3)
    .toNumber();

  // ── Flags ─────────────────────────────────────────────────────────────────
  const flags = generateFlags(gds, tds, ltv, stressGds, stressTds, borrower, property);

  // ── Decision ──────────────────────────────────────────────────────────────
  const failCount = flags.filter((f) => f.type === 'FAIL').length;
  const warnCount = flags.filter((f) => f.type === 'WARN').length;

  let decision: UWResult['decision'];
  if (failCount > 0) {
    decision = 'DECLINE';
  } else if (warnCount >= 2) {
    decision = 'MANUAL_REVIEW';
  } else {
    decision = 'APPROVE';
  }

  return {
    monthlyIncome: monthlyIncome.toDecimalPlaces(2).toNumber(),
    mortgageAmount: mortgageAmount.toNumber(),
    monthlyPayment,
    stressPayment,
    gds,
    tds,
    ltv,
    stressGds,
    stressTds,
    stressRate,
    flags,
    decision,
    qualifyingIncome: {
      baseSalary: primaryParts.baseSalary,
      bonus: primaryParts.bonus,
      overtime: primaryParts.overtime,
      otherIncome: primaryParts.otherIncome,
      selfEmployed: primaryParts.selfEmployed,
      rental: primaryParts.rental,
      coApplicant: coApplicantTotal.toDecimalPlaces(2).toNumber(),
      total: totalQualifyingIncome.toDecimalPlaces(2).toNumber(),
    },
  };
}
