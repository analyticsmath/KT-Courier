/**
 * Phase 29 CSV Sanitizer and Formula Injection Protection.
 * Protects against spreadsheet formula injection (=, +, -, @, \t, \r).
 */

const FORMULA_PREFIX_REGEX = /^[=+\-@\t\r]/;

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str: string;
  if (value instanceof Date) {
    str = value.toISOString();
  } else if (typeof value === "object") {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }

  // Prevent formula injection
  if (FORMULA_PREFIX_REGEX.test(str)) {
    str = `'${str}`;
  }

  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function formatCsvReport(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => sanitizeCsvCell(row[h])).join(",")
  );

  return [headerLine, ...dataLines].join("\n");
}

export function formatJsonReport(rows: Record<string, unknown>[]): string {
  return JSON.stringify(rows, null, 2);
}
