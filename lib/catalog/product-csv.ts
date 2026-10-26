import { CatalogPolicyError } from "@/lib/catalog/errors";
import { catalogImportCellIssues } from "@/lib/catalog/catalog-import-policy";
export const PRODUCT_CSV_MAX_BYTES = 64_000;
export const PRODUCT_CSV_MAX_ROWS = 100;
export const PRODUCT_CSV_HEADER = "title,shortDescription,description,attributes";
export type ProductCsvRow = { rowNumber: number; title: string; shortDescription: string; description: string; attributes: Record<string, unknown>; issues: string[] };

/** Bounded RFC4180 records; malformed structure is refused rather than shifted. */
export function parseProductCsv(csv: string): ProductCsvRow[] {
  if (!csv || Buffer.byteLength(csv, "utf8") > PRODUCT_CSV_MAX_BYTES) throw new CatalogPolicyError("IMPORT_SIZE", "Choose a nonempty CSV of at most 64 KB.");
  const input = csv.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let cells: string[] = [], cell = "", quoted = false, closed = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === ',' || c === '\r' || c === '\n') {
      cells.push(cell); cell = ""; closed = false;
      if (c !== ',') {
        if (c === '\r' && input[i + 1] === '\n') i++;
        if (cells.some(v => v.trim())) records.push(cells);
        cells = [];
      }
    } else {
      if (c === '"' || (closed && c.trim())) throw new CatalogPolicyError("IMPORT_CSV_SYNTAX", "Invalid quoting in the CSV. Export it again using UTF-8 CSV.");
      cell += c;
    }
  }
  if (quoted) throw new CatalogPolicyError("IMPORT_CSV_SYNTAX", "A quoted CSV field has no closing quote.");
  cells.push(cell); if (cells.some(v => v.trim())) records.push(cells);
  const header = records.shift()?.map(v => v.trim());
  const allowed = PRODUCT_CSV_HEADER.split(',');
  if (!header?.includes("title") || new Set(header).size !== header.length || header.some(h => !allowed.includes(h))) throw new CatalogPolicyError("IMPORT_CSV_HEADER", "Use title and optional shortDescription, description and attributes columns.");
  if (!records.length || records.length > PRODUCT_CSV_MAX_ROWS) throw new CatalogPolicyError("IMPORT_CSV_ROWS", "Provide between 1 and 100 products per import.");
  return records.map((values, index) => {
    const issues: string[] = [];
    if (values.length !== header.length) issues.push("Incorrect number of columns");
    const data = Object.fromEntries(header.map((h, i) => [h, (values[i] ?? "").trim()]));
    for (const [key, value] of Object.entries(data)) if (catalogImportCellIssues(value).length) issues.push(`${key}: unsafe content or unsupported remote URL`);
    if (data.title.length < 2 || data.title.length > 180) issues.push("Title must contain 2–180 characters");
    if ((data.shortDescription ?? "").length > 300) issues.push("Short description exceeds 300 characters");
    if ((data.description ?? "").length > 10_000) issues.push("Description exceeds 10,000 characters");
    let attributes: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(data.attributes || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      attributes = parsed as Record<string, unknown>;
    } catch { issues.push("Attributes must be a JSON object"); }
    return { rowNumber: index + 2, title: data.title, shortDescription: data.shortDescription ?? "", description: data.description ?? "", attributes, issues };
  });
}
