import {
  calculateMonthlyPayment,
  underwrite,
  IncomeInput,
  PropertyInput,
  TermsInput,
  BorrowerInput,
} from '../engine/underwrite';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A clean "base case" set of inputs that produces a known, passing result. */
function baseIncome(overrides: Partial<IncomeInput> = {}): IncomeInput {
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

function baseProperty(overrides: Partial<PropertyInput> = {}): PropertyInput {
  return {
    purchasePrice: 500000,
    appraisedValue: 500000,
    downPayment: 100000,
    annualTax: 4800,
    monthlyHeat: 150,
    condoFees: 0,
    ...overrides,
  };
}

function baseTerms(overrides: Partial<TermsInput> = {}): TermsInput {
  return {
    contractRate: 5,
    amortizationYears: 25,
    insured: false,
    ...overrides,
  };
}

function baseBorrower(overrides: Partial<BorrowerInput> = {}): BorrowerInput {
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

// ─── 1. calculateMonthlyPayment ───────────────────────────────────────────────

describe('calculateMonthlyPayment', () => {
  it('$500k at 5% over 25 years returns ~$2,922.95', () => {
    const payment = calculateMonthlyPayment(500000, 5, 25);
    // Standard formula: P * r(1+r)^n / ((1+r)^n - 1) = 2922.95
    expect(payment).toBeCloseTo(2922.95, 0);
    expect(Math.abs(payment - 2922.95)).toBeLessThan(1);
  });

  it('$400k at 6% over 30 years returns ~$2,398.20', () => {
    const payment = calculateMonthlyPayment(400000, 6, 30);
    expect(payment).toBeCloseTo(2398.20, 0);
    expect(Math.abs(payment - 2398.20)).toBeLessThan(1);
  });

  it('0% interest rate does not divide by zero — returns principal / n', () => {
    // 120000 at 0% for 10 years (120 months) = 1000/mo
    const payment = calculateMonthlyPayment(120000, 0, 10);
    expect(payment).toBeCloseTo(1000, 2);
  });

  it('0% rate: $500k over 25 years = ~$1,666.67/mo', () => {
    const payment = calculateMonthlyPayment(500000, 0, 25);
    expect(payment).toBeCloseTo(500000 / 300, 2);
  });
});

// ─── 2. Stress rate ───────────────────────────────────────────────────────────

describe('stress rate', () => {
  it('contractRate 3.5% → stressRate = 5.5% (contractRate + 2 = 5.5 > floor 5.25)', () => {
    // max(3.5 + 2, 5.25) = max(5.5, 5.25) = 5.5
    const result = underwrite(baseIncome(), baseProperty(), baseTerms({ contractRate: 3.5 }), baseBorrower());
    expect(result.stressRate).toBe(5.5);
  });

  it('contractRate 4.0% → stressRate = 6.0% (contractRate + 2)', () => {
    const result = underwrite(baseIncome(), baseProperty(), baseTerms({ contractRate: 4.0 }), baseBorrower());
    expect(result.stressRate).toBe(6.0);
  });

  it('contractRate 5.0% → stressRate = 7.0%', () => {
    const result = underwrite(baseIncome(), baseProperty(), baseTerms({ contractRate: 5.0 }), baseBorrower());
    expect(result.stressRate).toBe(7.0);
  });

  it('contractRate 1.0% → stressRate = 5.25% (floor dominates over 3.0%)', () => {
    const result = underwrite(baseIncome(), baseProperty(), baseTerms({ contractRate: 1.0 }), baseBorrower());
    expect(result.stressRate).toBe(5.25);
  });
});

// ─── 3. Income qualification ──────────────────────────────────────────────────

describe('income qualification', () => {
  describe('EMPLOYED', () => {
    it('2+ years: base, bonus, and overtime all included', () => {
      const income = baseIncome({
        baseSalary: 80000,
        bonus: 10000,
        overtime: 5000,
        yearsEmployed: 2,
        employmentType: 'EMPLOYED',
      });
      const result = underwrite(income, baseProperty(), baseTerms(), baseBorrower());
      expect(result.qualifyingIncome.baseSalary).toBe(80000);
      expect(result.qualifyingIncome.bonus).toBe(10000);
      expect(result.qualifyingIncome.overtime).toBe(5000);
      expect(result.qualifyingIncome.total).toBe(95000);
    });

    it('< 2 years: bonus and overtime excluded', () => {
      const income = baseIncome({
        baseSalary: 80000,
        bonus: 10000,
        overtime: 5000,
        yearsEmployed: 1,
        employmentType: 'EMPLOYED',
      });
      const result = underwrite(income, baseProperty(), baseTerms(), baseBorrower());
      expect(result.qualifyingIncome.baseSalary).toBe(80000);
      expect(result.qualifyingIncome.bonus).toBe(0);
      expect(result.qualifyingIncome.overtime).toBe(0);
      expect(result.qualifyingIncome.total).toBe(80000);
    });
  });

  describe('SELF_EMPLOYED', () => {
    it('uses selfEmployedAvg as qualifying income', () => {
      const income = baseIncome({
        selfEmployedAvg: 75000,
        baseSalary: 0,
        employmentType: 'SELF_EMPLOYED',
        yearsEmployed: 3,
      });
      const result = underwrite(income, baseProperty(), baseTerms(), baseBorrower({ employmentType: 'SELF_EMPLOYED', yearsEmployed: 3 }));
      expect(result.qualifyingIncome.selfEmployed).toBe(75000);
      expect(result.qualifyingIncome.baseSalary).toBe(0);
      expect(result.qualifyingIncome.total).toBe(75000);
    });

    it('no selfEmployedAvg → $0 income from self-employed field', () => {
      const income = baseIncome({
        selfEmployedAvg: null,
        baseSalary: 0,
        employmentType: 'SELF_EMPLOYED',
        yearsEmployed: 3,
      });
      const result = underwrite(income, baseProperty(), baseTerms(), baseBorrower({ employmentType: 'SELF_EMPLOYED', yearsEmployed: 3 }));
      expect(result.qualifyingIncome.selfEmployed).toBe(0);
    });
  });

  describe('CONTRACT', () => {
    it('only baseSalary counted — bonus excluded', () => {
      const income = baseIncome({
        baseSalary: 90000,
        bonus: 20000,
        employmentType: 'CONTRACT',
        yearsEmployed: 3,
      });
      const result = underwrite(income, baseProperty(), baseTerms(), baseBorrower({ employmentType: 'CONTRACT' }));
      expect(result.qualifyingIncome.baseSalary).toBe(90000);
      expect(result.qualifyingIncome.bonus).toBe(0);
      expect(result.qualifyingIncome.total).toBe(90000);
    });
  });

  describe('RETIRED / OTHER', () => {
    it('RETIRED: only otherIncome counted', () => {
      const income = baseIncome({
        baseSalary: 0,
        otherIncome: 30000,
        employmentType: 'RETIRED',
        yearsEmployed: null,
      });
      const result = underwrite(income, baseProperty(), baseTerms(), baseBorrower({ employmentType: 'RETIRED', yearsEmployed: null }));
      expect(result.qualifyingIncome.otherIncome).toBe(30000);
      expect(result.qualifyingIncome.baseSalary).toBe(0);
      expect(result.qualifyingIncome.total).toBe(30000);
    });

    it('OTHER: only otherIncome counted', () => {
      const income = baseIncome({
        baseSalary: 0,
        otherIncome: 30000,
        employmentType: 'OTHER',
        yearsEmployed: null,
      });
      const result = underwrite(income, baseProperty(), baseTerms(), baseBorrower({ employmentType: 'OTHER', yearsEmployed: null }));
      expect(result.qualifyingIncome.otherIncome).toBe(30000);
      expect(result.qualifyingIncome.total).toBe(30000);
    });
  });

  describe('Rental income', () => {
    it('rentalIncome $24k → qualifying rental = $12k (50%)', () => {
      const income = baseIncome({ rentalIncome: 24000 });
      const result = underwrite(income, baseProperty(), baseTerms(), baseBorrower());
      expect(result.qualifyingIncome.rental).toBe(12000);
      expect(result.qualifyingIncome.total).toBe(96000 + 12000);
    });
  });
});

// ─── 4. GDS / TDS / LTV calculations ─────────────────────────────────────────

describe('GDS / TDS / LTV calculations', () => {
  /**
   * Base case:
   *   purchase $500k, down $100k (20%) → mortgage $400k
   *   annualTax $4,800 ($400/mo), heat $150/mo, condoFees $0
   *   contractRate 5%, amortization 25yr
   *   baseSalary $96,000/yr → monthlyIncome $8,000
   *
   *   monthlyPayment(400000, 5, 25) ≈ $2,338.36
   *   housingCosts = 2338.36 + 400 + 150 = 2888.36
   *   GDS = 2888.36 / 8000 * 100 ≈ 36.105%
   *   TDS = GDS (no other obligations in engine)
   *   LTV = 400000 / 500000 * 100 = 80%
   */
  let result: ReturnType<typeof underwrite>;

  beforeAll(() => {
    result = underwrite(
      baseIncome({ baseSalary: 96000 }),
      baseProperty({
        purchasePrice: 500000,
        appraisedValue: 500000,
        downPayment: 100000,
        annualTax: 4800,
        monthlyHeat: 150,
        condoFees: 0,
      }),
      baseTerms({ contractRate: 5, amortizationYears: 25 }),
      baseBorrower()
    );
  });

  it('mortgageAmount is $400,000', () => {
    expect(result.mortgageAmount).toBe(400000);
  });

  it('monthlyIncome is $8,000', () => {
    expect(result.monthlyIncome).toBe(8000);
  });

  it('monthlyPayment is approximately $2,338', () => {
    expect(result.monthlyPayment).toBeCloseTo(2338.36, 0);
  });

  it('GDS is within 0.1 of 36.105%', () => {
    const expectedGds = (2338.36 + 400 + 150) / 8000 * 100;
    expect(Math.abs(result.gds - expectedGds)).toBeLessThan(0.1);
  });

  it('TDS equals GDS (no other obligations)', () => {
    expect(result.tds).toBe(result.gds);
  });

  it('LTV = 80%', () => {
    expect(result.ltv).toBe(80);
  });

  it('stressRate = 7% (5% + 2)', () => {
    expect(result.stressRate).toBe(7);
  });
});

// ─── 5. Flag generation ───────────────────────────────────────────────────────

describe('flag generation', () => {
  // ── LTV flags ─────────────────────────────────────────────────────────────

  it('LTV > 95 → FAIL flag mentioning LTV', () => {
    // purchase 500k, down 10k (2%) → mortgage 490k → LTV 98%
    const result = underwrite(
      baseIncome(),
      baseProperty({ purchasePrice: 500000, downPayment: 10000, appraisedValue: 500000 }),
      baseTerms(),
      baseBorrower()
    );
    const flag = result.flags.find((f) => f.field === 'ltv');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('FAIL');
    expect(flag!.message.toLowerCase()).toContain('ltv');
  });

  it('LTV > 80 and <= 95 → WARN flag mentioning CMHC', () => {
    // purchase 500k, down 30k (6%) → mortgage 470k → LTV 94%
    const result = underwrite(
      baseIncome(),
      baseProperty({ purchasePrice: 500000, downPayment: 30000, appraisedValue: 500000 }),
      baseTerms(),
      baseBorrower()
    );
    const flag = result.flags.find((f) => f.field === 'ltv');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('WARN');
    expect(flag!.message.toLowerCase()).toContain('cmhc');
  });

  it('LTV = 80 → no LTV FAIL or WARN (conventional PASS)', () => {
    // purchase 500k, down 100k (20%) → mortgage 400k → LTV exactly 80%
    const result = underwrite(
      baseIncome(),
      baseProperty({ purchasePrice: 500000, downPayment: 100000, appraisedValue: 500000 }),
      baseTerms(),
      baseBorrower()
    );
    const ltvFail = result.flags.find((f) => f.field === 'ltv' && f.type === 'FAIL');
    const ltvWarn = result.flags.find((f) => f.field === 'ltv' && f.type === 'WARN');
    expect(ltvFail).toBeUndefined();
    expect(ltvWarn).toBeUndefined();
    // down payment flag should be PASS (conventional)
    const dpFlag = result.flags.find((f) => f.field === 'downPayment');
    expect(dpFlag!.type).toBe('PASS');
  });

  // ── GDS flags ─────────────────────────────────────────────────────────────

  it('GDS > 39 → FAIL flag on GDS', () => {
    // Force high GDS: income $7,000/mo (annual $84k), mortgage 400k → GDS ~41.3%
    const result = underwrite(
      baseIncome({ baseSalary: 84000 }),
      baseProperty({ purchasePrice: 500000, downPayment: 100000, appraisedValue: 500000 }),
      baseTerms({ contractRate: 5, amortizationYears: 25 }),
      baseBorrower()
    );
    expect(result.gds).toBeGreaterThan(39);
    const flag = result.flags.find((f) => f.field === 'gds' && f.type === 'FAIL');
    expect(flag).toBeDefined();
    expect(flag!.message.toLowerCase()).toContain('gds');
  });

  it('GDS > 35 and <= 39 → WARN flag on GDS', () => {
    // income $7,800/mo (annual $93.6k) → GDS ~37.0%
    const result = underwrite(
      baseIncome({ baseSalary: 93600 }),
      baseProperty({ purchasePrice: 500000, downPayment: 100000, appraisedValue: 500000 }),
      baseTerms({ contractRate: 5, amortizationYears: 25 }),
      baseBorrower()
    );
    expect(result.gds).toBeGreaterThan(35);
    expect(result.gds).toBeLessThanOrEqual(39);
    const flag = result.flags.find((f) => f.field === 'gds');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('WARN');
    expect(flag!.message.toLowerCase()).toContain('gds');
  });

  // ── TDS flags ─────────────────────────────────────────────────────────────

  it('TDS > 44 → FAIL flag on TDS', () => {
    // income $5,900/mo (annual $70.8k) → TDS ~48.9%
    const result = underwrite(
      baseIncome({ baseSalary: 70800 }),
      baseProperty({ purchasePrice: 500000, downPayment: 100000, appraisedValue: 500000 }),
      baseTerms({ contractRate: 5, amortizationYears: 25 }),
      baseBorrower()
    );
    expect(result.tds).toBeGreaterThan(44);
    const flag = result.flags.find((f) => f.field === 'tds' && f.type === 'FAIL');
    expect(flag).toBeDefined();
    expect(flag!.message.toLowerCase()).toContain('tds');
  });

  it('TDS > 40 and <= 44 → WARN flag on TDS', () => {
    // income $6,700/mo (annual $80.4k) → TDS ~43.1%
    const result = underwrite(
      baseIncome({ baseSalary: 80400 }),
      baseProperty({ purchasePrice: 500000, downPayment: 100000, appraisedValue: 500000 }),
      baseTerms({ contractRate: 5, amortizationYears: 25 }),
      baseBorrower()
    );
    expect(result.tds).toBeGreaterThan(40);
    expect(result.tds).toBeLessThanOrEqual(44);
    const flag = result.flags.find((f) => f.field === 'tds');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('WARN');
    expect(flag!.message.toLowerCase()).toContain('tds');
  });

  // ── Credit score flags ────────────────────────────────────────────────────

  it('creditScore < 600 → FAIL flag', () => {
    const result = underwrite(
      baseIncome(),
      baseProperty(),
      baseTerms(),
      baseBorrower({ creditScore: 550 })
    );
    const flag = result.flags.find((f) => f.field === 'creditScore');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('FAIL');
    expect(flag!.message.toLowerCase()).toContain('credit');
  });

  it('600 <= creditScore < 660 → WARN flag', () => {
    const result = underwrite(
      baseIncome(),
      baseProperty(),
      baseTerms(),
      baseBorrower({ creditScore: 630 })
    );
    const flag = result.flags.find((f) => f.field === 'creditScore');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('WARN');
    expect(flag!.message.toLowerCase()).toContain('credit');
  });

  it('creditScore >= 720 → PASS flag for strong credit', () => {
    const result = underwrite(
      baseIncome(),
      baseProperty(),
      baseTerms(),
      baseBorrower({ creditScore: 780 })
    );
    const flag = result.flags.find((f) => f.field === 'creditScore');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('PASS');
    expect(flag!.message.toLowerCase()).toContain('credit');
  });

  // ── Bankruptcy / collections ──────────────────────────────────────────────

  it('bankruptcies = true → FAIL flag', () => {
    const result = underwrite(
      baseIncome(),
      baseProperty(),
      baseTerms(),
      baseBorrower({ bankruptcies: true })
    );
    const flag = result.flags.find((f) => f.field === 'bankruptcies');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('FAIL');
    expect(flag!.message.toLowerCase()).toContain('bankrupt');
  });

  it('collections = true → WARN flag', () => {
    const result = underwrite(
      baseIncome(),
      baseProperty(),
      baseTerms(),
      baseBorrower({ collections: true })
    );
    const flag = result.flags.find((f) => f.field === 'collections');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('WARN');
    expect(flag!.message.toLowerCase()).toContain('collection');
  });

  // ── Down payment flags ────────────────────────────────────────────────────

  it('downPayment < 5% of purchasePrice → FAIL flag', () => {
    // 500k purchase, $20k down (4%) < minimum $25k (5%)
    const result = underwrite(
      baseIncome(),
      baseProperty({ purchasePrice: 500000, downPayment: 20000, appraisedValue: 500000 }),
      baseTerms(),
      baseBorrower()
    );
    const flag = result.flags.find((f) => f.field === 'downPayment');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('FAIL');
    expect(flag!.message.toLowerCase()).toContain('down payment');
  });

  it('downPayment >= 20% of purchasePrice → PASS flag (conventional)', () => {
    const result = underwrite(
      baseIncome(),
      baseProperty({ purchasePrice: 500000, downPayment: 100000, appraisedValue: 500000 }),
      baseTerms(),
      baseBorrower()
    );
    const flag = result.flags.find((f) => f.field === 'downPayment');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('PASS');
    expect(flag!.message.toLowerCase()).toContain('conventional');
  });

  // ── Employment flags ──────────────────────────────────────────────────────

  it('SELF_EMPLOYED + yearsEmployed < 2 → WARN flag', () => {
    const result = underwrite(
      baseIncome({ employmentType: 'SELF_EMPLOYED', selfEmployedAvg: 80000, yearsEmployed: 1 }),
      baseProperty(),
      baseTerms(),
      baseBorrower({ employmentType: 'SELF_EMPLOYED', yearsEmployed: 1 })
    );
    const flag = result.flags.find((f) => f.field === 'yearsEmployed');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('WARN');
    expect(flag!.message.toLowerCase()).toContain('self-employed');
  });

  it('SELF_EMPLOYED + yearsEmployed = null → WARN flag', () => {
    const result = underwrite(
      baseIncome({ employmentType: 'SELF_EMPLOYED', selfEmployedAvg: 80000, yearsEmployed: null }),
      baseProperty(),
      baseTerms(),
      baseBorrower({ employmentType: 'SELF_EMPLOYED', yearsEmployed: null })
    );
    const flag = result.flags.find((f) => f.field === 'yearsEmployed');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('WARN');
  });

  // ── Existing mortgages ────────────────────────────────────────────────────

  it('existingMortgages > 1 → WARN flag', () => {
    const result = underwrite(
      baseIncome(),
      baseProperty(),
      baseTerms(),
      baseBorrower({ existingMortgages: 2 })
    );
    const flag = result.flags.find((f) => f.field === 'existingMortgages');
    expect(flag).toBeDefined();
    expect(flag!.type).toBe('WARN');
    expect(flag!.message.toLowerCase()).toContain('existing');
  });

  it('existingMortgages = 1 → no existingMortgages flag', () => {
    const result = underwrite(
      baseIncome(),
      baseProperty(),
      baseTerms(),
      baseBorrower({ existingMortgages: 1 })
    );
    const flag = result.flags.find((f) => f.field === 'existingMortgages');
    expect(flag).toBeUndefined();
  });
});

// ─── 6. Decision logic ────────────────────────────────────────────────────────

describe('decision logic', () => {
  it('all PASS flags (or no WARN/FAIL) → APPROVE', () => {
    // Clean inputs: good credit, 20% down, income easily covers payments
    const result = underwrite(
      baseIncome({ baseSalary: 200000 }),
      baseProperty(),
      baseTerms(),
      baseBorrower({ creditScore: 800 })
    );
    expect(result.flags.filter((f) => f.type === 'FAIL')).toHaveLength(0);
    expect(result.flags.filter((f) => f.type === 'WARN')).toHaveLength(0);
    expect(result.decision).toBe('APPROVE');
  });

  it('exactly 1 WARN flag → APPROVE', () => {
    // collections=true adds exactly 1 WARN, everything else passes cleanly
    const result = underwrite(
      baseIncome({ baseSalary: 200000 }),
      baseProperty(),
      baseTerms(),
      baseBorrower({ creditScore: 800, collections: true })
    );
    const warns = result.flags.filter((f) => f.type === 'WARN');
    const fails = result.flags.filter((f) => f.type === 'FAIL');
    expect(fails).toHaveLength(0);
    expect(warns).toHaveLength(1);
    expect(result.decision).toBe('APPROVE');
  });

  it('2+ WARN flags → MANUAL_REVIEW', () => {
    // collections + existingMortgages > 1 → 2 WARNs
    const result = underwrite(
      baseIncome({ baseSalary: 200000 }),
      baseProperty(),
      baseTerms(),
      baseBorrower({ creditScore: 800, collections: true, existingMortgages: 2 })
    );
    const warns = result.flags.filter((f) => f.type === 'WARN');
    const fails = result.flags.filter((f) => f.type === 'FAIL');
    expect(fails).toHaveLength(0);
    expect(warns.length).toBeGreaterThanOrEqual(2);
    expect(result.decision).toBe('MANUAL_REVIEW');
  });

  it('any FAIL flag → DECLINE', () => {
    const result = underwrite(
      baseIncome(),
      baseProperty(),
      baseTerms(),
      baseBorrower({ bankruptcies: true })
    );
    expect(result.flags.some((f) => f.type === 'FAIL')).toBe(true);
    expect(result.decision).toBe('DECLINE');
  });

  it('multiple FAIL flags → DECLINE (not MANUAL_REVIEW)', () => {
    // creditScore < 600 + bankruptcies = 2 FAILs
    const result = underwrite(
      baseIncome(),
      baseProperty(),
      baseTerms(),
      baseBorrower({ creditScore: 550, bankruptcies: true })
    );
    const fails = result.flags.filter((f) => f.type === 'FAIL');
    expect(fails.length).toBeGreaterThanOrEqual(2);
    expect(result.decision).toBe('DECLINE');
  });

  it('FAIL + WARN together → DECLINE (FAIL takes precedence)', () => {
    // bankruptcy (FAIL) + collections (WARN)
    const result = underwrite(
      baseIncome(),
      baseProperty(),
      baseTerms(),
      baseBorrower({ bankruptcies: true, collections: true })
    );
    expect(result.decision).toBe('DECLINE');
  });
});

// ─── 7. Co-borrower income ────────────────────────────────────────────────────

describe('co-borrower income', () => {
  it('primary $50k + co-borrower $40k → combined qualifying $90k/yr', () => {
    const income: IncomeInput = {
      baseSalary: 50000,
      bonus: 0,
      overtime: 0,
      otherIncome: 0,
      selfEmployedAvg: null,
      rentalIncome: 0,
      yearsEmployed: 3,
      employmentType: 'EMPLOYED',
      coIncome: {
        baseSalary: 40000,
        bonus: 0,
        overtime: 0,
        otherIncome: 0,
        selfEmployedAvg: null,
        rentalIncome: 0,
        yearsEmployed: 3,
        employmentType: 'EMPLOYED',
      },
    };

    const result = underwrite(income, baseProperty(), baseTerms(), baseBorrower());

    expect(result.qualifyingIncome.coApplicant).toBeCloseTo(40000, 0);
    expect(result.qualifyingIncome.total).toBeCloseTo(90000, 0);
    expect(result.monthlyIncome).toBeCloseTo(7500, 0);
  });

  it('co-borrower with <2 years employment has bonus/overtime excluded', () => {
    const income: IncomeInput = {
      baseSalary: 50000,
      bonus: 0,
      overtime: 0,
      otherIncome: 0,
      selfEmployedAvg: null,
      rentalIncome: 0,
      yearsEmployed: 3,
      employmentType: 'EMPLOYED',
      coIncome: {
        baseSalary: 40000,
        bonus: 10000,
        overtime: 5000,
        otherIncome: 0,
        selfEmployedAvg: null,
        rentalIncome: 0,
        yearsEmployed: 1,
        employmentType: 'EMPLOYED',
      },
    };

    const result = underwrite(income, baseProperty(), baseTerms(), baseBorrower());

    // co-borrower bonus/overtime excluded due to < 2 years
    expect(result.qualifyingIncome.coApplicant).toBeCloseTo(40000, 0);
    expect(result.qualifyingIncome.total).toBeCloseTo(90000, 0);
  });
});

// ─── 8. Edge cases ────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('monthlyIncome = 0 → GDS and TDS return 0 (no divide-by-zero)', () => {
    const income = baseIncome({
      baseSalary: 0,
      bonus: 0,
      overtime: 0,
      otherIncome: 0,
      selfEmployedAvg: null,
      rentalIncome: 0,
    });
    const result = underwrite(income, baseProperty(), baseTerms(), baseBorrower());
    expect(result.monthlyIncome).toBe(0);
    expect(result.gds).toBe(0);
    expect(result.tds).toBe(0);
    expect(result.stressGds).toBe(0);
    expect(result.stressTds).toBe(0);
  });

  it('purchasePrice = appraisedValue → LTV uses that value as base', () => {
    const result = underwrite(
      baseIncome(),
      baseProperty({ purchasePrice: 500000, appraisedValue: 500000, downPayment: 100000 }),
      baseTerms(),
      baseBorrower()
    );
    expect(result.ltv).toBeCloseTo(80, 2);
  });

  it('appraisedValue < purchasePrice → LTV uses appraisedValue (conservative)', () => {
    // purchase 500k, appraised 450k, down 100k → mortgage 400k → LTV = 400/450 = 88.9%
    const result = underwrite(
      baseIncome(),
      baseProperty({ purchasePrice: 500000, appraisedValue: 450000, downPayment: 100000 }),
      baseTerms(),
      baseBorrower()
    );
    const expectedLtv = (400000 / 450000) * 100;
    expect(result.ltv).toBeCloseTo(expectedLtv, 1);
    expect(result.ltv).toBeGreaterThan(80); // conservative — triggers CMHC WARN
  });

  it('appraisedValue > purchasePrice → LTV uses purchasePrice (lower, conservative)', () => {
    // purchase 500k, appraised 600k, down 100k → mortgage 400k → LTV = 400/500 = 80%
    // (min of 500k and 600k = 500k, same as base case)
    const result = underwrite(
      baseIncome(),
      baseProperty({ purchasePrice: 500000, appraisedValue: 600000, downPayment: 100000 }),
      baseTerms(),
      baseBorrower()
    );
    expect(result.ltv).toBeCloseTo(80, 2);
  });

  it('condoFees are counted at 50% in housing cost ratios', () => {
    // With $600/mo condo fees, only $300 should affect GDS
    const withCondo = underwrite(
      baseIncome({ baseSalary: 96000 }),
      baseProperty({ condoFees: 600 }),
      baseTerms(),
      baseBorrower()
    );
    const withoutCondo = underwrite(
      baseIncome({ baseSalary: 96000 }),
      baseProperty({ condoFees: 0 }),
      baseTerms(),
      baseBorrower()
    );
    // GDS difference should be 300/8000*100 = 3.75%
    expect(withCondo.gds - withoutCondo.gds).toBeCloseTo(3.75, 1);
  });
});
