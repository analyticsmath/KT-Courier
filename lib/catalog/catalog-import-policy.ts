import { CatalogPolicyError } from "@/lib/catalog/errors";

export const CATALOG_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const CATALOG_IMPORT_MAX_ROWS = 5_000;
export const CATALOG_IMPORT_TEMPLATE_VERSION = 1;

const FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/;
const HTML = /<\/?[a-z][^>]*>/i;

export function assertCatalogImportFile(value: {
  filename: string;
  mimeType: string;
  byteSize: number;
  templateVersion: number;
}): void {
  if (!value.filename.toLocaleLowerCase("en-ZA").endsWith(".csv") || !["text/csv", "application/csv", "text/plain"].includes(value.mimeType)) {
    throw new CatalogPolicyError("CATALOG_IMPORT_CSV_ONLY", "Catalog imports must be CSV files.");
  }
  if (!Number.isSafeInteger(value.byteSize) || value.byteSize < 1 || value.byteSize > CATALOG_IMPORT_MAX_BYTES) {
    throw new CatalogPolicyError("CATALOG_IMPORT_SIZE", "Catalog import file size is outside the allowed limit.");
  }
  if (value.templateVersion !== CATALOG_IMPORT_TEMPLATE_VERSION) {
    throw new CatalogPolicyError("CATALOG_IMPORT_TEMPLATE", "Catalog import template version is unsupported.");
  }
}

export function catalogImportCellIssues(value: string): string[] {
  const issues: string[] = [];
  if (FORMULA_PREFIX.test(value)) issues.push("CSV_FORMULA_INJECTION");
  if (HTML.test(value)) issues.push("HTML_NOT_ALLOWED");
  if (/https?:\/\//i.test(value)) issues.push("REMOTE_URL_NOT_ALLOWED");
  if (value.length > 10_000) issues.push("CELL_TOO_LARGE");
  return issues;
}

export function assertCatalogImportCanValidate(value: { status: string; rowStatuses: string[] }): void {
  if (value.status !== "UPLOADED" && value.status !== "VALIDATED") {
    throw new CatalogPolicyError("CATALOG_IMPORT_STATE_INVALID", "Only uploaded catalog imports can be validated.");
  }
  if (value.rowStatuses.length === 0) {
    throw new CatalogPolicyError("CATALOG_IMPORT_EMPTY", "No parsed CSV rows exist for this import. Upload and parse the product file before validating.");
  }
  if (value.rowStatuses.length > CATALOG_IMPORT_MAX_ROWS) {
    throw new CatalogPolicyError("CATALOG_IMPORT_ROW_LIMIT", "Catalog import exceeds the row limit.");
  }
  if (value.rowStatuses.some((status) => status !== "VALID" && status !== "INVALID")) {
    throw new CatalogPolicyError("CATALOG_IMPORT_ROWS_PENDING", "Every imported CSV row must be parsed and checked before dry-run validation.");
  }
}

export function assertCatalogImportCanApply(value: {
  dryRunCompleted: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  status: string;
}): void {
  if (
    !value.dryRunCompleted ||
    value.status !== "VALIDATED" ||
    !Number.isSafeInteger(value.totalRows) ||
    !Number.isSafeInteger(value.validRows) ||
    !Number.isSafeInteger(value.invalidRows) ||
    value.totalRows < 1 ||
    value.totalRows > CATALOG_IMPORT_MAX_ROWS ||
    value.validRows !== value.totalRows ||
    value.invalidRows !== 0
  ) {
    throw new CatalogPolicyError("CATALOG_IMPORT_NOT_READY", "A successful nonempty dry-run with no invalid or pending rows is required before apply.");
  }
}
