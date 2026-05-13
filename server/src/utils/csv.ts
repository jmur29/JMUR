/**
 * Converts an array of flat objects to a CSV string.
 * Headers are derived from Object.keys of the first row.
 * Values containing commas, quotes, or newlines are quoted and internal quotes are escaped.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);

  const escape = (value: unknown): string => {
    const str = value === null || value === undefined ? '' : String(value);
    // Wrap in quotes if the value contains a comma, double-quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(escape).join(',');
  const dataRows = rows.map((row) => headers.map((h) => escape(row[h])).join(','));

  return [headerRow, ...dataRows].join('\n');
}
