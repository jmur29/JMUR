/**
 * Integration-style tests for the underwriting engine.
 * Each scenario exercises a complete end-to-end underwriting decision,
 * verifying the decision outcome, flag types, and key ratio ranges.
 */

import {
  underwrite,
  IncomeInput,
  PropertyInput,
  TermsInput,
  BorrowerInput,
  UWResult,
} from '../engine/underwrite';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function income(overrides: Partial<IncomeInput> = {}): IncomeInput {
  return {
    baseSalary: 96000,
    bonus: 0,
    overtime: 0,
    otherIncome: 0,
    selfEmployedAvg: null,
    rentalIncome: 0,
    yearsEmployed: 3,
    employmentType: 'EMPLOYED',
    ...overrides,
  };
}

function property(overrides: Partial<PropertyInput> = {}): PropertyInput {
  return {
    purchasePrice: 500000,
    appraisedValue: 500000,
    downPayment: 125000, // 25%
    annualTax: 4800,
    monthlyHeat: 150,
    condoFees: 0,
    ...overrides,
  };
}

function terms(overrides: Partial<TermsInput> = {}): TermsInput {
  return {
    contractRate: 5,
    amortizationYears: 25,
    insured: false,
    ...overrides,
  };
}

function borrower(overrides: Partial<BorrowerInput> = {}): BorrowerInput {
  return {
    creditScore: 720,
    bankruptcies: false,
    collections: false,
    employmentType: 'EMPLOYED',
    existingMortgages: 0,
    yearsEmployed: 3,
    ...overrides,
  };
}

function failFlags(result: UWResult) {
  return result.flags.filter((f) => f.type === 'FAIL');
}

function warnFlags(result: UWResult) {
  return result.flags.filter((f) => f.type === 'WARN');
}

// ─── Scenario A: Clean approval ───────────────────────────────────────────────

describe('Scenario A — Clean approval (strong credit, 25% down, employed 5yr, 5% rate)', () => {
  let result: UWResult;

  beforeAll(() => {
    result = underwrite(
      income({ baseSalary: 120000, yearsEmployed: 5 }),
      property({
        purchasePrice: 500000,
        appraisedValue: 500000,
        downPayment: 125000, // 25%
        annualTax: 4800,
        monthlyHeat: 150,
      }),
      terms({ contractRate: 5, amortizationYears: 25 }),
      borrower({ creditScore: 750, yearsEmployed: 5 })
    );
  });

  it('decision is APPROVE', () => {
    expect(result.decision).toBe('APPROVE');
  });

  it('has no FAIL flags', () => {
    expect(failFlags(result)).toHaveLength(0);
  });

  it('LTV is 75% (25% down on 500k → mortgage 375k)', () => {
    expect(result.ltv).toBeCloseTo(75, 1);
  });

  it('GDS is below 35% (well-qualified)', () => {
    expect(result.gds).toBeLessThan(35);
  });

  it('TDS is below 40%', () => {
    expect(result.tds).toBeLessThan(40);
  });

  it('creditScore flag is PASS for 750 score', () => {
    const creditFlag = result.flags.find((f) => f.field === 'creditScore');
    expect(creditFlag).toBeDefined();
    expect(creditFlag!.type).toBe('PASS');
  });

  it('downPayment flag is PASS (conventional)', () => {
    const dpFlag = result.flags.find((f) => f.field === 'downPayment');
    expect(dpFlag).toBeDefined();
    expect(dpFlag!.type).toBe('PASS');
  });
});

// ─── Scenario B: CMHC insured ─────────────────────────────────────────────────

describe('Scenario B — CMHC insured (10% down, good income, clean credit)', () => {
  let result: UWResult;

  beforeAll(() => {
    // 10% down = $50k on $500k → LTV = 80% (450k/500k)
    result = underwrite(
      income({ baseSalary: 110000, yearsEmployed: 4 }),
      property({
        purchasePrice: 500000,
        appraisedValue: 500000,
        downPayment: 50000, // 10%
        annualTax: 4800,
        monthlyHeat: 150,
      }),
      terms({ contractRate: 4.5, amortizationYears: 25, insured: true }),
      borrower({ creditScore: 700, yearsEmployed: 4 })
    );
  });

  it('decision is APPROVE or MANUAL_REVIEW (no FAILs — outcome depends on stress test)', () => {
    // No FAIL flags means at most MANUAL_REVIEW; strict DECLINE is not possible
    expect(failFlags(result)).toHaveLength(0);
    expect(['APPROVE', 'MANUAL_REVIEW']).toContain(result.decision);
  });

  it('has no FAIL flags', () => {
    expect(failFlags(result)).toHaveLength(0);
  });

  it('LTV is above 80% (triggering CMHC WARN)', () => {
    expect(result.ltv).toBeGreaterThan(80);
    expect(result.ltv).toBeLessThanOrEqual(95);
  });

  it('has a WARN flag on ltv mentioning CMHC insurance', () => {
    const ltvFlag = result.flags.find((f) => f.field === 'ltv');
    expect(ltvFlag).toBeDefined();
    expect(ltvFlag!.type).toBe('WARN');
    expect(ltvFlag!.message.toLowerCase()).toContain('cmhc');
  });

  it('CMHC WARN flag is present (ltv field)', () => {
    const ltvWarn = warnFlags(result).find((f) => f.field === 'ltv');
    expect(ltvWarn).toBeDefined();
  });

  it('GDS is within acceptable range', () => {
    expect(result.gds).toBeLessThan(39);
  });
});

// ─── Scenario C: Stress test failure ─────────────────────────────────────────

describe('Scenario C — Stress test failure (tight income, high rate)', () => {
  let result: UWResult;

  beforeAll(() => {
    // Income just barely passes at contract rate but fails stress
    // baseSalary $72k → monthlyIncome $6k
    // mortgage $400k at 5% → payment ~$2,338, GDS = (2338+400+150)/6000*100 ≈ 48% → FAIL
    // Use income high enough that contract rate passes but stress rate triggers warn
    // $90k/yr = $7500/mo; mortgage 375k at 5% → payment ~$2194, housing = 2194+400+150 = 2744
    // GDS = 2744/7500 = 36.6% → WARN on GDS (>35)
    // stress rate = 7%, payment ~$2646, stressGDS = (2646+400+150)/7500 = 42.6% → WARN stressGds
    result = underwrite(
      income({ baseSalary: 90000, yearsEmployed: 3 }),
      property({
        purchasePrice: 500000,
        appraisedValue: 500000,
        downPayment: 125000, // 25%
        annualTax: 4800,
        monthlyHeat: 150,
      }),
      terms({ contractRate: 5, amortizationYears: 25 }),
      borrower({ creditScore: 700, yearsEmployed: 3 })
    );
  });

  it('decision is MANUAL_REVIEW (multiple WARNs from stress + GDS)', () => {
    // Expects at least 2 WARNs → MANUAL_REVIEW
    expect(result.decision).toBe('MANUAL_REVIEW');
  });

  it('has no FAIL flags', () => {
    expect(failFlags(result)).toHaveLength(0);
  });

  it('has at least 2 WARN flags', () => {
    expect(warnFlags(result).length).toBeGreaterThanOrEqual(2);
  });

  it('stressGds exceeds 39% (stress test fail)', () => {
    expect(result.stressGds).toBeGreaterThan(39);
  });

  it('stressTds exceeds 44% (stress test fail)', () => {
    expect(result.stressTds).toBeGreaterThan(44);
  });

  it('has stressGds WARN flag', () => {
    const stressFlag = result.flags.find((f) => f.field === 'stressGds');
    expect(stressFlag).toBeDefined();
    expect(stressFlag!.type).toBe('WARN');
  });
});

// ─── Scenario D: Full decline ─────────────────────────────────────────────────

describe('Scenario D — Full decline (bankrupt flag + low credit + LTV > 95)', () => {
  let result: UWResult;

  beforeAll(() => {
    result = underwrite(
      income({ baseSalary: 60000, yearsEmployed: 1 }),
      property({
        purchasePrice: 500000,
        appraisedValue: 500000,
        downPayment: 15000, // 3% → LTV = 97%
        annualTax: 4800,
        monthlyHeat: 150,
      }),
      terms({ contractRate: 5.5, amortizationYears: 25 }),
      borrower({
        creditScore: 520, // < 600 → FAIL
        bankruptcies: true, // FAIL
        collections: false,
        yearsEmployed: 1,
      })
    );
  });

  it('decision is DECLINE', () => {
    expect(result.decision).toBe('DECLINE');
  });

  it('has 3 or more FAIL flags', () => {
    expect(failFlags(result).length).toBeGreaterThanOrEqual(3);
  });

  it('has creditScore FAIL flag', () => {
    const f = result.flags.find((f) => f.field === 'creditScore');
    expect(f).toBeDefined();
    expect(f!.type).toBe('FAIL');
  });

  it('has bankruptcies FAIL flag', () => {
    const f = result.flags.find((f) => f.field === 'bankruptcies');
    expect(f).toBeDefined();
    expect(f!.type).toBe('FAIL');
  });

  it('has LTV FAIL flag (LTV > 95)', () => {
    expect(result.ltv).toBeGreaterThan(95);
    const f = result.flags.find((f) => f.field === 'ltv');
    expect(f).toBeDefined();
    expect(f!.type).toBe('FAIL');
  });

  it('LTV is above 97% (15k down on 500k → 485k/500k)', () => {
    expect(result.ltv).toBeCloseTo(97, 0);
  });
});

// ─── Scenario E: Self-employed 1 year ────────────────────────────────────────

describe('Scenario E — Self-employed 1yr (NOA warn, avg income not used)', () => {
  let result: UWResult;

  beforeAll(() => {
    result = underwrite(
      income({
        baseSalary: 0,
        selfEmployedAvg: 95000,
        yearsEmployed: 1,
        employmentType: 'SELF_EMPLOYED',
      }),
      property({
        purchasePrice: 400000,
        appraisedValue: 400000,
        downPayment: 80000, // 20%
        annualTax: 4200,
        monthlyHeat: 140,
      }),
      terms({ contractRate: 5, amortizationYears: 25 }),
      borrower({
        creditScore: 700,
        bankruptcies: false,
        collections: false,
        employmentType: 'SELF_EMPLOYED',
        yearsEmployed: 1,
      })
    );
  });

  it('has a WARN flag for self-employed NOA requirement', () => {
    const flag = result.flags.find((f) => f.field === 'yearsEmployed');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('WARN');
    expect(flag!.message.toLowerCase()).toContain('self-employed');
    expect(flag!.message.toLowerCase()).toContain('noa');
  });

  it('qualifying income uses selfEmployedAvg (not baseSalary)', () => {
    expect(result.qualifyingIncome.selfEmployed).toBe(95000);
    expect(result.qualifyingIncome.baseSalary).toBe(0);
  });

  it('total qualifying income is 95000', () => {
    expect(result.qualifyingIncome.total).toBe(95000);
  });

  it('has no FAIL flags (credit score 700, 20% down, income ok)', () => {
    expect(failFlags(result)).toHaveLength(0);
  });

  it('decision is APPROVE or MANUAL_REVIEW (NOA warn may trigger review)', () => {
    // 1 WARN = APPROVE; if stress test also fires → MANUAL_REVIEW
    expect(['APPROVE', 'MANUAL_REVIEW']).toContain(result.decision);
  });
});

// ─── Scenario F: Co-borrower saves the deal ───────────────────────────────────

describe('Scenario F — Co-borrower saves the deal', () => {
  let soloResult: UWResult;
  let coResult: UWResult;

  const sharedProperty: PropertyInput = {
    purchasePrice: 600000,
    appraisedValue: 600000,
    downPayment: 120000, // 20%
    annualTax: 5400,
    monthlyHeat: 175,
    condoFees: 0,
  };

  const sharedTerms: TermsInput = {
    contractRate: 5,
    amortizationYears: 25,
    insured: false,
  };

  const sharedBorrower: BorrowerInput = {
    creditScore: 710,
    bankruptcies: false,
    collections: false,
    employmentType: 'EMPLOYED',
    existingMortgages: 0,
    yearsEmployed: 4,
  };

  beforeAll(() => {
    // Solo: $75k income → monthly $6,250
    // mortgage $480k at 5% → payment ~$2,808
    // housing costs = 2808 + 450 + 175 = 3433
    // GDS = 3433/6250*100 = 54.9% → FAIL → DECLINE
    soloResult = underwrite(
      income({ baseSalary: 75000, yearsEmployed: 4 }),
      sharedProperty,
      sharedTerms,
      sharedBorrower
    );

    // With co-borrower $60k: combined = $135k/yr = $11,250/mo
    // GDS = 3433/11250*100 = 30.5% → well under 35 → PASS
    coResult = underwrite(
      income({
        baseSalary: 75000,
        yearsEmployed: 4,
        coIncome: {
          baseSalary: 60000,
          bonus: 0,
          overtime: 0,
          otherIncome: 0,
          selfEmployedAvg: null,
          rentalIncome: 0,
          yearsEmployed: 4,
          employmentType: 'EMPLOYED',
        },
      }),
      sharedProperty,
      sharedTerms,
      sharedBorrower
    );
  });

  it('solo borrower gets DECLINE (GDS exceeds 39%)', () => {
    expect(soloResult.gds).toBeGreaterThan(39);
    expect(soloResult.decision).toBe('DECLINE');
    expect(failFlags(soloResult).some((f) => f.field === 'gds')).toBe(true);
  });

  it('combined borrowers have higher monthly income', () => {
    expect(coResult.monthlyIncome).toBeGreaterThan(soloResult.monthlyIncome);
    expect(coResult.monthlyIncome).toBeCloseTo(11250, 0);
  });

  it('co-borrower income is included in qualifying income', () => {
    expect(coResult.qualifyingIncome.coApplicant).toBe(60000);
    expect(coResult.qualifyingIncome.total).toBe(135000);
  });

  it('GDS with co-borrower drops below 35%', () => {
    expect(coResult.gds).toBeLessThan(35);
  });

  it('co-borrower scenario results in APPROVE or MANUAL_REVIEW (not DECLINE)', () => {
    expect(coResult.decision).not.toBe('DECLINE');
    expect(['APPROVE', 'MANUAL_REVIEW']).toContain(coResult.decision);
  });

  it('no GDS FAIL flag with co-borrower', () => {
    const gdsFailFlag = coResult.flags.find((f) => f.field === 'gds' && f.type === 'FAIL');
    expect(gdsFailFlag).toBeUndefined();
  });
});
