import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { catalogFoundation } from "./catalog-canonical-support";
import { createCatalogImportJob, validateCatalogImportJob, applyCatalogImportJob } from "@/lib/services/catalog-import.service";

async function fixture(csv = 'title,shortDescription\nFirst imported product,Summary\nSecond imported product,Summary') {
  const role = new URL(process.env.DATABASE_URL!).username;
  if (role !== "disposable" && role !== "kt_closure_test") throw new Error("Named disposable catalog or closure runner required.");
  const f = await catalogFoundation(role);
  const input = { filename: "products.csv", mimeType: "text/csv", byteSize: Buffer.byteLength(csv), templateVersion: 1, operationId: randomUUID(), csv, productTypeDefinitionId: f.definition.id, primaryCategoryId: f.category.id };
  return { ...f, input };
}

describe("vendor product CSV on isolated PostgreSQL", { timeout: 30_000 }, () => {
  it("persists preview without products, then atomically applies and replays concurrent requests", async () => {
    const f = await fixture();
    const before = await prisma.catalogProduct.count({ where: { sourceStoreId: f.store.id } });
    const job = await createCatalogImportJob(f.store.id, f.user.id, f.input);
    expect(job).toMatchObject({ status: "UPLOADED", totalRows: 2, validRows: 2, invalidRows: 0 });
    expect(await prisma.catalogProduct.count({ where: { sourceStoreId: f.store.id } })).toBe(before);
    expect((await createCatalogImportJob(f.store.id, f.user.id, f.input)).id).toBe(job.id);
    await expect(applyCatalogImportJob(f.store.id, f.user.id, job.publicReference)).rejects.toMatchObject({ code: "CATALOG_IMPORT_NOT_READY" });
    const preview = await validateCatalogImportJob(f.store.id, job.publicReference);
    expect(preview.rows).toHaveLength(2);
    const [a, b] = await Promise.all([applyCatalogImportJob(f.store.id, f.user.id, job.publicReference), applyCatalogImportJob(f.store.id, f.user.id, job.publicReference)]);
    expect(a.id).toBe(b.id); expect(a.status).toBe("COMPLETED");
    expect(a.rows.every(row => row.status === "APPLIED" && row.resultingProductId)).toBe(true);
    expect(await prisma.catalogProduct.count({ where: { sourceStoreId: f.store.id } })).toBe(before + 2);
    const products = await prisma.catalogProduct.findMany({ where: { id: { in: a.rows.map(row => row.resultingProductId!) } }, include: { variants: true, offers: true } });
    expect(products.every(p => p.scope === "STORE_PRIVATE" && p.status === "DRAFT" && p.publicationStatus === "DRAFT" && p.variants.length === 1 && !p.offers.length)).toBe(true);
    await expect(validateCatalogImportJob(f.store.id, job.publicReference)).rejects.toMatchObject({ code: "CATALOG_IMPORT_STATE_INVALID" });
  });
  it("persists per-row errors, blocks all apply, refuses changed replay and foreign access", async () => {
    const f = await fixture('title\nValid product\nx');
    const job = await createCatalogImportJob(f.store.id, f.user.id, f.input);
    const preview = await validateCatalogImportJob(f.store.id, job.publicReference);
    expect(preview.invalidRows).toBe(1); expect(preview.rows[1].errorCodes).not.toEqual([]);
    await expect(applyCatalogImportJob(f.store.id, f.user.id, job.publicReference)).rejects.toMatchObject({ code: "CATALOG_IMPORT_NOT_READY" });
    const csv = 'title\nChanged product';
    await expect(createCatalogImportJob(f.store.id, f.user.id, { ...f.input, csv, byteSize: Buffer.byteLength(csv) })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
    await expect(validateCatalogImportJob("foreign-store", job.publicReference)).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" });
    await expect(applyCatalogImportJob("foreign-store", f.user.id, job.publicReference)).rejects.toThrow();
  });
  it("rolls back the whole batch if the canonical product command refuses a later row", async () => {
    const f = await fixture(); const job = await createCatalogImportJob(f.store.id, f.user.id, f.input);
    await validateCatalogImportJob(f.store.id, job.publicReference);
    const rows = await prisma.catalogImportRow.findMany({ where: { jobId: job.id }, orderBy: { rowNumber: "asc" } });
    await prisma.catalogImportRow.update({ where: { id: rows[1].id }, data: { normalizedPayload: { ...(rows[1].normalizedPayload as object), productTypeDefinitionId: "nonexistent-product-type" } } });
    const before = await prisma.catalogProduct.count({ where: { sourceStoreId: f.store.id } });
    await expect(applyCatalogImportJob(f.store.id, f.user.id, job.publicReference)).rejects.toThrow();
    expect(await prisma.catalogProduct.count({ where: { sourceStoreId: f.store.id } })).toBe(before);
    expect(await prisma.catalogImportRow.count({ where: { jobId: job.id, status: "APPLIED" } })).toBe(0);
    expect((await prisma.catalogImportJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("VALIDATED");
  });
});
