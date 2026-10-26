import { expect, it } from "vitest";
import { CatalogImportActionSchema } from "@/lib/validation/catalog";
import { parseProductCsv } from "@/lib/catalog/product-csv";
it("reads UTF-8 BOM, quoted commas, doubled quotes and embedded newlines", () => {
  const rows = parseProductCsv('\uFEFFtitle,description,attributes\r\n"Cable, USB-C","A ""durable"" cable\nOne metre","{""colour"":""blue""}"\r\n');
  expect(rows[0]).toMatchObject({ title: "Cable, USB-C", description: 'A "durable" cable\nOne metre', attributes: { colour: "blue" }, issues: [] });
});
it("returns row errors and never silently drops bad products", () => {
  const rows = parseProductCsv('title,attributes\na,[]\n=SUM(A1),{}\nGood product,{},extra');
  expect(rows).toHaveLength(3); expect(rows.every(row => row.issues.length)).toBe(true);
});
it("rejects unsupported headers, truncated quoting, empty and excessive batches", () => {
  for (const csv of ['name\nA', 'title,title\nA,B', 'title\n"open', 'title\n', 'title\n' + 'Valid product\n'.repeat(101), 'title\n' + 'x'.repeat(64000)]) expect(() => parseProductCsv(csv)).toThrow();
});

it("accepts import actions without inventing a product version while rejecting client-owned scope", () => {
  expect(CatalogImportActionSchema.safeParse({ operationId: "import-action-123" }).success).toBe(true);
  expect(CatalogImportActionSchema.safeParse({ operationId: "import-action-123", storeId: "other" }).success).toBe(false);
});
