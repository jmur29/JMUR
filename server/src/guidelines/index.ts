// ─── calculateMinimumDownPayment ──────────────────────────────────────────────

/**
 * Calculates the minimum down payment required under OSFI/CMHC rules.
 *
 * <= $500,000:          5% of full price
 * $500,001–$999,999:   5% of first $500k + 10% of remainder
 * >= $1,000,000:       20% (conventional, no CMHC)
 */
export function calculateMinimumDownPayment(purchasePrice: number): {
  minimumAmount: number;
  minimumPercent: number;
  isConventional: boolean;
  cmhcRequired: boolean;
} {
  let minimumAmount: number;

  if (purchasePrice >= 1_000_000) {
    minimumAmount = purchasePrice * 0.2;
  } else if (purchasePrice > 500_000) {
    minimumAmount = 500_000 * 0.05 + (purchasePrice - 500_000) * 0.1;
  } else {
    minimumAmount = purchasePrice * 0.05;
  }

  const minimumPercent = (minimumAmount / purchasePrice) * 100;
  const isConventional = minimumPercent >= 20;
  const cmhcRequired = !isConventional;

  return { minimumAmount, minimumPercent, isConventional, cmhcRequired };
}

// ─── getLargeDepositThreshold ─────────────────────────────────────────────────

/**
 * Returns the threshold above which a single deposit is considered "large"
 * and requires sourcing. Equals 25% of grossMonthlyIncome, or $5,000 if null.
 */
export function getLargeDepositThreshold(grossMonthlyIncome: number | null): number {
  if (grossMonthlyIncome === null) return 5_000;
  return grossMonthlyIncome * 0.25;
}

// ─── getRequiredSourcingStartDate ─────────────────────────────────────────────

/**
 * Returns the date 90 days before the closing date — the earliest date from
 * which bank statements must be sourced for down payment verification.
 */
export function getRequiredSourcingStartDate(closingDate: Date): Date {
  const result = new Date(closingDate.getTime());
  result.setDate(result.getDate() - 90);
  return result;
}
