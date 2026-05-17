import {
  calculateMinimumDownPayment,
  getLargeDepositThreshold,
  getRequiredSourcingStartDate,
} from '../guidelines';

// ─── calculateMinimumDownPayment ──────────────────────────────────────────────

describe('calculateMinimumDownPayment', () => {
  test('$400,000 — 5% of full price = $20,000', () => {
    const result = calculateMinimumDownPayment(400_000);
    expect(result.minimumAmount).toBeCloseTo(20_000, 2);
    expect(result.minimumPercent).toBeCloseTo(5, 2);
    expect(result.isConventional).toBe(false);
    expect(result.cmhcRequired).toBe(true);
  });

  test('$600,000 — 5% of first $500k + 10% of $100k = $35,000', () => {
    const result = calculateMinimumDownPayment(600_000);
    expect(result.minimumAmount).toBeCloseTo(35_000, 2);
    // 35000 / 600000 * 100 ≈ 5.833%
    expect(result.minimumPercent).toBeCloseTo(5.833, 1);
    expect(result.isConventional).toBe(false);
    expect(result.cmhcRequired).toBe(true);
  });

  test('$1,100,000 — 20% = $220,000 (conventional, no CMHC)', () => {
    const result = calculateMinimumDownPayment(1_100_000);
    expect(result.minimumAmount).toBeCloseTo(220_000, 2);
    expect(result.minimumPercent).toBeCloseTo(20, 2);
    expect(result.isConventional).toBe(true);
    expect(result.cmhcRequired).toBe(false);
  });

  test('$500,000 exactly — 5% = $25,000', () => {
    const result = calculateMinimumDownPayment(500_000);
    expect(result.minimumAmount).toBeCloseTo(25_000, 2);
    expect(result.isConventional).toBe(false);
  });

  test('$1,000,000 exactly — 20% conventional', () => {
    const result = calculateMinimumDownPayment(1_000_000);
    expect(result.minimumAmount).toBeCloseTo(200_000, 2);
    expect(result.isConventional).toBe(true);
  });
});

// ─── getLargeDepositThreshold ─────────────────────────────────────────────────

describe('getLargeDepositThreshold', () => {
  test('returns 25% of monthly income when income provided', () => {
    // $6,000/mo → 25% = $1,500
    const result = getLargeDepositThreshold(6_000);
    expect(result).toBeCloseTo(1_500, 2);
  });

  test('returns $5,000 default when income is null', () => {
    const result = getLargeDepositThreshold(null);
    expect(result).toBe(5_000);
  });

  test('returns 25% of another income value', () => {
    // $10,000/mo → 25% = $2,500
    const result = getLargeDepositThreshold(10_000);
    expect(result).toBeCloseTo(2_500, 2);
  });
});

// ─── getRequiredSourcingStartDate ─────────────────────────────────────────────

describe('getRequiredSourcingStartDate', () => {
  test('closing May 17 2026 → Feb 16 2026 (90 days prior)', () => {
    const closing = new Date('2026-05-17T00:00:00.000Z');
    const result = getRequiredSourcingStartDate(closing);
    // May 17 - 90 days = Feb 16 2026
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(1); // February (0-indexed)
    expect(result.getUTCDate()).toBe(16);
  });

  test('returns a date exactly 90 days before closing', () => {
    const closing = new Date('2025-10-01T00:00:00.000Z');
    const result = getRequiredSourcingStartDate(closing);
    const expected = new Date('2025-07-03T00:00:00.000Z');
    expect(result.getTime()).toBe(expected.getTime());
  });

  test('does not mutate the input date', () => {
    const closing = new Date('2026-05-17T00:00:00.000Z');
    const original = closing.getTime();
    getRequiredSourcingStartDate(closing);
    expect(closing.getTime()).toBe(original);
  });
});
