import { CatalogPolicyError } from "./errors";
export const INVENTORY_UPLOAD_HEADER = "inventoryReference,locationReference,version,quantity";
export type InventoryUploadRow = { inventoryReference: string; locationReference: string; version: number; quantity: number };
/** Bounded stock-receipt template: identifiers and integers, no free text or formulas. */
export function parseInventoryUpload(csv: string): InventoryUploadRow[] {
  const fail = (message: string): never => { throw new CatalogPolicyError("INVENTORY_UPLOAD_INVALID", message); };
  if (csv.length > 64_000) fail("Inventory CSV must be at most 64 KB.");
  const lines = csv.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  if (lines.shift() !== INVENTORY_UPLOAD_HEADER || lines.length < 1 || lines.length > 100) fail("Use the stock-receipt template with 1 to 100 rows.");
  const seen = new Set<string>();
  return lines.map((line, index) => {
    const cells = line.split(",").map(cell => cell.trim());
    if (cells.length !== 4 || !cells.slice(0, 2).every(cell => /^[A-Za-z0-9][A-Za-z0-9_-]{3,99}$/.test(cell)) || !cells.slice(2).every(cell => /^(?:0|[1-9]\d{0,9})$/.test(cell))) fail(`Row ${index + 2}: use two references, current version and positive whole-unit quantity.`);
    const [inventoryReference, locationReference] = cells;
    const version = Number(cells[2]), quantity = Number(cells[3]);
    if (!Number.isSafeInteger(version) || version > 2_147_483_647 || quantity < 1 || quantity > 2_147_483_647 || seen.has(inventoryReference)) fail(`Row ${index + 2}: quantity/version is invalid or inventory item is repeated.`);
    seen.add(inventoryReference);
    return { inventoryReference, locationReference, version, quantity };
  });
}
