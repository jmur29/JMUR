import {
  checkBalanceIntegrity,
  checkEmployerConsistency,
  checkRoundNumberDeposits,
} from '../fraud';
import type { RawTransaction } from '../ai';

// ─── checkBalanceIntegrity ────────────────────────────────────────────────────

describe('checkBalanceIntegrity', () => {
  test('returns null when all balances reconcile exactly', () => {
    const txs: RawTransaction[] = [
      { date: '2024-01-01', description: 'Opening', debit: null, credit: null, balance: 1000.00 },
      { date: '2024-01-02', description: 'PAYROLL',  debit: null, credit: 2000.00, balance: 3000.00 },
      { date: '2024-01-03', description: 'RENT',     debit: 500.00, credit: null, balance: 2500.00 },
    ];
    const result = checkBalanceIntegrity(txs);
    expect(result).toBeNull();
  });

  test('returns signal for a $0.01 mismatch', () => {
    const txs: RawTransaction[] = [
      { date: '2024-01-01', description: 'Opening', debit: null, credit: null, balance: 1000.00 },
      // Expected: 1000 + 500 = 1500, but actual is 1500.01 → diff $0.01
      { date: '2024-01-02', description: 'DEPOSIT', debit: null, credit: 500.00, balance: 1500.01 },
    ];
    const result = checkBalanceIntegrity(txs);
    expect(result).not.toBeNull();
    expect(result?.signalType).toBe('BALANCE_MISMATCH');
  });

  test('returns signal for a large mismatch', () => {
    const txs: RawTransaction[] = [
      { date: '2024-01-01', description: 'Opening', debit: null, credit: null, balance: 5000.00 },
      // Expected: 5000 + 0 - 100 = 4900, actual 3000 → diff $1900
      { date: '2024-01-02', description: 'PAYMENT', debit: 100.00, credit: null, balance: 3000.00 },
    ];
    const result = checkBalanceIntegrity(txs);
    expect(result).not.toBeNull();
    expect(result?.signalType).toBe('BALANCE_MISMATCH');
    expect(result?.severity).toBe('MEDIUM');
  });

  test('ignores rows where balance is null', () => {
    const txs: RawTransaction[] = [
      { date: '2024-01-01', description: 'Opening', debit: null, credit: null, balance: null },
      { date: '2024-01-02', description: 'DEPOSIT', debit: null, credit: 500.00, balance: null },
    ];
    const result = checkBalanceIntegrity(txs);
    expect(result).toBeNull();
  });

  test('within $0.01 tolerance is not flagged', () => {
    const txs: RawTransaction[] = [
      { date: '2024-01-01', description: 'Opening', debit: null, credit: null, balance: 1000.00 },
      // Expected: 1000 + 200 = 1200, actual 1200.005 → diff $0.005 < $0.01
      { date: '2024-01-02', description: 'DEPOSIT', debit: null, credit: 200.00, balance: 1200.005 },
    ];
    const result = checkBalanceIntegrity(txs);
    expect(result).toBeNull();
  });
});

// ─── checkEmployerConsistency ─────────────────────────────────────────────────

describe('checkEmployerConsistency', () => {
  test('returns null for identical strings', () => {
    const result = checkEmployerConsistency('ACME Corporation', 'ACME Corporation');
    expect(result).toBeNull();
  });

  test('returns null for minor variation (typo / case difference)', () => {
    // "Acme Corp" vs "ACME Corp." — Levenshtein distance is small, similarity high
    const result = checkEmployerConsistency('Acme Corp', 'ACME Corp');
    expect(result).toBeNull();
  });

  test('returns null for abbreviated vs full (high similarity)', () => {
    // "TD Bank" vs "TD Bank" — same
    const result = checkEmployerConsistency('TD Bank', 'TD Bank');
    expect(result).toBeNull();
  });

  test('returns signal for completely different employers', () => {
    const result = checkEmployerConsistency('ACME Corporation', 'Global Finance Ltd');
    expect(result).not.toBeNull();
    expect(result?.signalType).toBe('EMPLOYER_MISMATCH');
    expect(result?.severity).toBe('HIGH');
  });

  test('returns signal when similarity < 0.8', () => {
    const result = checkEmployerConsistency('Tim Hortons Canada', 'Starbucks Coffee Company');
    expect(result).not.toBeNull();
    expect(result?.signalType).toBe('EMPLOYER_MISMATCH');
  });
});

// ─── checkRoundNumberDeposits ─────────────────────────────────────────────────

describe('checkRoundNumberDeposits', () => {
  test('flags a $5,000 round number credit with no payroll keyword', () => {
    const txs: RawTransaction[] = [
      { date: '2024-02-01', description: 'TRANSFER FROM SAVINGS', debit: null, credit: 5000.00, balance: 10000.00 },
    ];
    const signals = checkRoundNumberDeposits(txs);
    expect(signals).toHaveLength(1);
    expect(signals[0].signalType).toBe('ROUND_NUMBER');
  });

  test('does not flag a $4,999 credit (below threshold)', () => {
    const txs: RawTransaction[] = [
      { date: '2024-02-01', description: 'TRANSFER', debit: null, credit: 4999.00, balance: 9999.00 },
    ];
    const signals = checkRoundNumberDeposits(txs);
    expect(signals).toHaveLength(0);
  });

  test('does not flag $10,000 round credit with DIRECT DEPOSIT keyword', () => {
    const txs: RawTransaction[] = [
      { date: '2024-02-15', description: 'DIRECT DEPOSIT EMPLOYER PAYROLL', debit: null, credit: 10000.00, balance: 15000.00 },
    ];
    const signals = checkRoundNumberDeposits(txs);
    expect(signals).toHaveLength(0);
  });

  test('does not flag a non-round credit >= $5,000', () => {
    const txs: RawTransaction[] = [
      { date: '2024-02-01', description: 'E-TRANSFER', debit: null, credit: 5250.75, balance: 8000.00 },
    ];
    const signals = checkRoundNumberDeposits(txs);
    expect(signals).toHaveLength(0);
  });

  test('flags multiple round deposits', () => {
    const txs: RawTransaction[] = [
      { date: '2024-02-01', description: 'WIRE TRANSFER', debit: null, credit: 5000.00, balance: 5000.00 },
      { date: '2024-02-10', description: 'INTERAC E-TRANSFER', debit: null, credit: 10000.00, balance: 15000.00 },
    ];
    const signals = checkRoundNumberDeposits(txs);
    expect(signals).toHaveLength(2);
    expect(signals[1].severity).toBe('HIGH');
  });

  test('does not flag debit entries', () => {
    const txs: RawTransaction[] = [
      { date: '2024-02-01', description: 'RENT PAYMENT', debit: 5000.00, credit: null, balance: 5000.00 },
    ];
    const signals = checkRoundNumberDeposits(txs);
    expect(signals).toHaveLength(0);
  });

  test('does not flag credits with PAYROLL keyword', () => {
    const txs: RawTransaction[] = [
      { date: '2024-02-01', description: 'PAYROLL ABC COMPANY', debit: null, credit: 6000.00, balance: 6000.00 },
    ];
    const signals = checkRoundNumberDeposits(txs);
    expect(signals).toHaveLength(0);
  });
});
