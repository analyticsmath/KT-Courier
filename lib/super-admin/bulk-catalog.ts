import { z } from "zod";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { catalogRequestHash } from "@/lib/catalog/catalog-normalization";
import { catalogImportCellIssues } from "@/lib/catalog/catalog-import-policy";
import { createStorePrivateCatalogProduct } from "@/lib/services/catalog-product.service";
import { ManagedCommerceError } from "@/lib/super-admin/commerce.service";

export type BulkCatalogRow = { title: string; shortDescription?: string };
const BULK_MAX_BYTES = 64_000;
const BULK_MAX_ROWS = 100;
const columns = ["title", "shortDescription"];
const safeRow = z.object({ title: z.string().trim().min(2).max(180), shortDescription: z.string().trim().max(300).optional() }).strict();

/** CSV parser with RFC4180 quotes and CRLF; fail-closed rather than accepting silently shifted columns. */
export function parseManagedCatalogCsv(csv: string): BulkCatalogRow[] {
  if (!csv || Buffer.byteLength(csv, "utf8") > BULK_MAX_BYTES) throw new ManagedCommerceError("CATALOG_CSV_SIZE", "Select a CSV no larger than 64 KB.");
  const input = csv.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let cells: string[] = [], cell = "", quoted = false, closedQuote = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else cell += char;
      continue;
    }
    if (char === '"' && !cell && !closedQuote) { quoted = true; continue; }
    if (char === ',') { cells.push(cell); cell = ""; closedQuote = false; continue; }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      cells.push(cell); if (cells.some(v => v.trim())) records.push(cells);
      cells = []; cell = ""; closedQuote = false;
      continue;
    }
    if (char === '"' || (closedQuote && char.trim())) throw new ManagedCommerceError("CATALOG_CSV_SYNTAX", "Invalid CSV quoting or extra text after a quoted cell.");
    cell += char;
  }
  if (quoted) throw new ManagedCommerceError("CATALOG_CSV_SYNTAX", "A quoted field has no closing quotation mark.");
  cells.push(cell); if (cells.some(v => v.trim())) records.push(cells);
  const header = records.shift()?.map(v => v.trim());
  if (!header || header.length < 1 || header.length > columns.length || header[0] !== "title" || new Set(header).size !== header.length || header.some(h => !columns.includes(h)))
    throw new ManagedCommerceError("CATALOG_CSV_HEADER", "CSV columns must be title and optionally shortDescription.");
  if (records.length < 1 || records.length > BULK_MAX_ROWS) throw new ManagedCommerceError("CATALOG_CSV_ROWS", "Provide between 1 and 100 product rows per import.");
  return records.map((record, index) => {
    if (record.length !== header.length) throw new ManagedCommerceError("CATALOG_CSV_COLUMNS", `Row ${index + 2} has an incorrect number of columns.`);
    const data: Record<string, string> = {};
    header.forEach((h, i) => {
      if (catalogImportCellIssues(record[i]).length) throw new ManagedCommerceError("CATALOG_CSV_UNSAFE", `Row ${index + 2} contains unsafe content.`);
      data[h] = record[i].trim();
    });
    const result = safeRow.safeParse(data);
    if (!result.success) throw new ManagedCommerceError("CATALOG_CSV_INVALID", `Row ${index + 2}: ${result.error.issues[0]?.message ?? "Invalid product."}`);
    return result.data;
  });
}

const batchSchema = z.object({
  storeId: z.string().min(15).max(64), productTypeDefinitionId: z.string().min(20).max(64),
  primaryCategoryId: z.string().min(20).max(64), csv: z.string().min(1).max(64_000),
  operationId: z.string().min(8).max(120).regex(/^[a-zA-Z0-9:_-]+$/), dryRun: z.boolean(),
}).strict();

export async function importManagedCatalogDrafts(actorUserId: string, raw: unknown) {
  const valid = batchSchema.safeParse(raw);
  if (!valid.success) throw new ManagedCommerceError("CATALOG_BULK_INPUT_INVALID", valid.error.issues[0]?.message ?? "Invalid import parameters.");
  const input = valid.data;
  const rows = parseManagedCatalogCsv(input.csv);
  const store = await prisma.store.findFirst({ where: { id: input.storeId, status: { in: ["ACTIVE", "PENDING"] } }, select: { id: true } });
  if (!store) throw new ManagedCommerceError("STORE_NOT_EDITABLE", "Select an active or pending store.", 409);
  const types = await Promise.all([
    prisma.productTypeDefinition.findUnique({ where: { id: input.productTypeDefinitionId }, select: { status: true } }),
    prisma.catalogCategory.findUnique({ where: { id: input.primaryCategoryId }, select: { status: true } }),
  ]);
  if (!types[0] || !["ACTIVE", "APPROVED"].includes(types[0].status) || !types[1] || types[1].status !== "ACTIVE")
    throw new ManagedCommerceError("CATALOG_BULK_SCOPE_INVALID", "Use an approved product type and active category.");
  if (input.dryRun) return { preview: true, count: rows.length, rows };
  const batchHash = catalogRequestHash({ storeId: input.storeId, productTypeDefinitionId: input.productTypeDefinitionId, primaryCategoryId: input.primaryCategoryId, rows });
  // One transaction ensures no partial import; unique receipt and advisory lock prevent duplicate submits.
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT TRUE AS locked FROM pg_advisory_xact_lock(hashtextextended(${`super-admin-bulk:${actorUserId}:${input.operationId}`}, 0))`;
    const identity = { actorUserId, action: "SUPER_ADMIN_BULK_PRODUCTS", operationId: input.operationId };
    const existing = await tx.catalogOperationReceipt.findUnique({ where: { actorUserId_action_operationId: identity } });
    if (existing) {
      if (existing.requestHash !== batchHash || existing.storeId !== input.storeId) throw new ManagedCommerceError("CATALOG_BULK_REPLAY_MISMATCH", "This import operation was already used for other products.", 409);
      return { preview: false, count: rows.length, replayed: true, batchReference: existing.aggregateReference };
    }
    const productIds: string[] = [];
    for (const [i, row] of rows.entries()) {
      const created = await createStorePrivateCatalogProduct(input.storeId, actorUserId, {
        productTypeDefinitionId: input.productTypeDefinitionId, primaryCategoryId: input.primaryCategoryId,
        scope: "STORE_PRIVATE", condition: "NEW", attributeValues: {}, complianceValues: {},
        title: row.title, ...(row.shortDescription ? { shortDescription: row.shortDescription } : {}),
        operationId: `bulk-${createHash("sha256").update(`${input.operationId}:${i}`).digest("hex").slice(0,32)}`,
      }, tx);
      productIds.push(created.id);
    }
    const batchReference = `BULK-${createHash("sha256").update(`${actorUserId}:${input.operationId}`).digest("hex").slice(0,26).toUpperCase()}`;
    await tx.catalogOperationReceipt.create({ data: { ...identity, requestHash: batchHash, storeId: input.storeId, aggregateReference: batchReference } });
    await tx.adminActivityLog.create({ data: { actorUserId, entityType: "CatalogBulkImport", entityId: input.storeId, action: "CREATE", message: "Super Admin created unpublished catalog drafts from validated CSV.", metadata: { batchReference, rowCount: productIds.length } } });
    return { preview: false, count: productIds.length, replayed: false, batchReference };
  });
}
