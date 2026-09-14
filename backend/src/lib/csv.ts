// Prefix a leading =, +, -, or @ with a single quote so spreadsheet apps (Excel/Sheets) treat the
// value as text instead of evaluating it as a formula (CSV/formula-injection, OWASP CWE-1236).
function neutralizeFormulaPrefix(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeCsvField(value: string): string {
  const safe = neutralizeFormulaPrefix(value);
  if (safe.includes('"') || safe.includes(',') || safe.includes('\n') || safe.includes('\r')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function csvRow(fields: readonly (string | number)[]): string {
  return `${fields.map((f) => escapeCsvField(String(f))).join(',')}\r\n`;
}

// Writes one row at a time to the destination stream instead of buffering the whole CSV body as
// a single string (09-review-qa.md R-03 — avoid holding large report exports fully in memory).
export function writeCsvRow(
  stream: NodeJS.WritableStream,
  fields: readonly (string | number)[],
): void {
  stream.write(csvRow(fields));
}
