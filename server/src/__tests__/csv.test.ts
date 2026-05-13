import { toCsv } from '../utils/csv';

describe('toCsv', () => {
  // ── Basic output ─────────────────────────────────────────────────────────────

  it('produces correct header and data rows for a basic array of objects', () => {
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const result = toCsv(rows);
    const lines = result.split('\n');
    expect(lines[0]).toBe('name,age');
    expect(lines[1]).toBe('Alice,30');
    expect(lines[2]).toBe('Bob,25');
    expect(lines).toHaveLength(3);
  });

  it('returns empty string for an empty array (no headers available)', () => {
    expect(toCsv([])).toBe('');
  });

  // ── Special characters ───────────────────────────────────────────────────────

  it('wraps values containing commas in double quotes', () => {
    const rows = [{ address: '123 Main St, Suite 4' }];
    const result = toCsv(rows);
    const lines = result.split('\n');
    expect(lines[1]).toBe('"123 Main St, Suite 4"');
  });

  it('escapes internal double-quotes by doubling them', () => {
    const rows = [{ note: 'He said "hello"' }];
    const result = toCsv(rows);
    const lines = result.split('\n');
    expect(lines[1]).toBe('"He said ""hello"""');
  });

  it('wraps values containing newlines in double quotes', () => {
    const rows = [{ description: 'line1\nline2' }];
    const result = toCsv(rows);
    // The whole CSV result contains the newline inside quotes, so we can't just
    // split on \n naively. Check the raw string contains the quoted form.
    expect(result).toContain('"line1\nline2"');
  });

  it('wraps values containing carriage returns in double quotes', () => {
    const rows = [{ text: 'foo\rbar' }];
    const result = toCsv(rows);
    expect(result).toContain('"foo\rbar"');
  });

  // ── Type coercion ────────────────────────────────────────────────────────────

  it('converts numbers to strings in the output', () => {
    const rows = [{ count: 42, ratio: 3.14 }];
    const result = toCsv(rows);
    const lines = result.split('\n');
    expect(lines[1]).toBe('42,3.14');
  });

  it('converts booleans to strings', () => {
    const rows = [{ active: true, deleted: false }];
    const result = toCsv(rows);
    const lines = result.split('\n');
    expect(lines[1]).toBe('true,false');
  });

  it('converts null to empty string', () => {
    const rows = [{ name: 'Alice', middle: null }];
    const result = toCsv(rows);
    const lines = result.split('\n');
    expect(lines[1]).toBe('Alice,');
  });

  it('converts undefined to empty string', () => {
    const rows = [{ name: 'Bob', middle: undefined }];
    const result = toCsv(rows);
    const lines = result.split('\n');
    expect(lines[1]).toBe('Bob,');
  });

  // ── Multi-row ────────────────────────────────────────────────────────────────

  it('handles a mix of normal, quoted, and null values across multiple rows', () => {
    const rows = [
      { id: 1, label: 'Simple', note: null },
      { id: 2, label: 'With, comma', note: 'ok' },
      { id: 3, label: 'With "quote"', note: undefined },
    ];
    const result = toCsv(rows);
    const lines = result.split('\n');
    expect(lines[0]).toBe('id,label,note');
    expect(lines[1]).toBe('1,Simple,');
    expect(lines[2]).toBe('2,"With, comma",ok');
    expect(lines[3]).toBe('3,"With ""quote""",');
    expect(lines).toHaveLength(4);
  });
});
