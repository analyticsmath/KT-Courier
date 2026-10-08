import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { describeCatalogIntegration } from "./catalog-integration-guard";
import { catalogFoundation, catalogEvidence } from "./catalog-canonical-support";
import { createCatalogImportJob, validateCatalogImportJob, applyCatalogImportJob } from "@/lib/services/catalog-import.service";
describeCatalogIntegration("canonical catalog import staging", () => {
  it("persists one bound upload job and denies changed metadata and non-CSV input", async () => {
    const f = await catalogFoundation(); const command = { filename: "synthetic.csv", mimeType: "text/csv", byteSize: 100, templateVersion: 1, operationId: randomUUID() };
    const job = await createCatalogImportJob(f.store.id, f.user.id, command);
    expect(await createCatalogImportJob(f.store.id, f.user.id, command)).toEqual(job);
    await expect(createCatalogImportJob(f.store.id, f.user.id, { ...command, byteSize: 101 })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
    await expect(createCatalogImportJob(f.store.id, f.user.id, { ...command, filename: "synthetic.svg", operationId: randomUUID() })).rejects.toMatchObject({ code: "CATALOG_IMPORT_CSV_ONLY" });
    expect(await prisma.catalogImportJob.count({ where: { storeId: f.store.id } })).toBe(1);
  });
  it("records parsed row errors and refuses unvalidated, invalid and foreign apply without publishing", async () => {
    const f = await catalogFoundation(); const job = await createCatalogImportJob(f.store.id, f.user.id, { filename: "synthetic.csv", mimeType: "text/csv", byteSize: 100, templateVersion: 1, operationId: randomUUID() });
    await expect(applyCatalogImportJob(f.store.id, f.user.id, job.publicReference)).rejects.toMatchObject({ code: "CATALOG_IMPORT_NOT_READY" });
    await prisma.catalogImportRow.create({ data: { jobId: job.id, rowNumber: 1, status: "INVALID", normalizedPayload: { title: "=invalid" }, errorCodes: ["CSV_FORMULA_INJECTION"] } });
    const validated = await validateCatalogImportJob(f.store.id, job.publicReference); expect(validated).toMatchObject({ status: "VALIDATED", dryRunCompleted: true, invalidRows: 1, validRows: 0, totalRows: 1 });
    await expect(applyCatalogImportJob(f.store.id, f.user.id, job.publicReference)).rejects.toMatchObject({ code: "CATALOG_IMPORT_NOT_READY" });
    await expect(validateCatalogImportJob("foreign-store", job.publicReference)).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" });
    expect(await prisma.catalogImportJob.findUnique({ where: { id: job.id } })).toEqual(validated);
    expect(await prisma.catalogProduct.count({ where: { sourceStoreId: f.store.id } })).toBe(1); expect(await catalogEvidence(job.publicReference)).toMatchObject({ events: [], audit: [] });
  });
});

