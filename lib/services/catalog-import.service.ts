import { prisma } from "@/lib/db/prisma";
import { assertCatalogImportCanApply, assertCatalogImportFile } from "@/lib/catalog/catalog-import-policy";
import { catalogPublicReference, catalogRequestHash } from "@/lib/catalog/catalog-normalization";
import { CatalogConflictError, CatalogNotFoundError, CatalogOwnershipError } from "@/lib/catalog/errors";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";

export async function listStoreCatalogImports(storeId: string) {
  return prisma.catalogImportJob.findMany({ where: { storeId }, include: { rows: { where: { status: "INVALID" }, take: 100, orderBy: { rowNumber: "asc" } } }, orderBy: { createdAt: "desc" } });
}

export async function createCatalogImportJob(storeId: string, actorUserId: string, input: { filename: string; mimeType: string; byteSize: number; templateVersion: number; operationId: string }) {
  assertCatalogImportFile(input);
  const requestHash = catalogRequestHash(input);
  const replay = await prisma.catalogImportJob.findUnique({ where: { storeId_operationId: { storeId, operationId: input.operationId } } });
  if (replay) {
    if (replay.requestHash !== requestHash) throw new CatalogConflictError("OPERATION_REPLAY_MISMATCH", "Operation ID was already used with different import metadata.");
    return replay;
  }
  return prisma.catalogImportJob.create({ data: { publicReference: catalogPublicReference("CIJ"), storeId, templateVersion: input.templateVersion, operationId: input.operationId, requestHash, filename: input.filename, createdByUserId: actorUserId } });
}

export async function validateCatalogImportJob(storeId: string, publicReference: string) {
  const job = await prisma.catalogImportJob.findUnique({ where: { publicReference }, include: { rows: true } });
  if (!job) throw new CatalogNotFoundError("Catalog import was not found.");
  if (job.storeId !== storeId) throw new CatalogOwnershipError();
  const validRows = job.rows.filter((row) => row.status === "VALID").length;
  const invalidRows = job.rows.filter((row) => row.status === "INVALID").length;
  return prisma.catalogImportJob.update({ where: { id: job.id }, data: { status: "VALIDATED", dryRunCompleted: true, totalRows: job.rows.length, validRows, invalidRows, completedAt: new Date() } });
}

export async function applyCatalogImportJob(storeId: string, actorUserId: string, publicReference: string) {
  const job = await prisma.catalogImportJob.findUnique({ where: { publicReference } });
  if (!job) throw new CatalogNotFoundError("Catalog import was not found.");
  if (job.storeId !== storeId) throw new CatalogOwnershipError();
  assertCatalogImportCanApply(job);
  return prisma.$transaction(async (tx) => {
    const applied = await tx.catalogImportJob.update({ where: { id: job.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await recordCatalogEvidence(tx, { aggregateType: "IMPORT", aggregateReference: job.publicReference, aggregateVersion: 1, action: "DRAFTS_APPLIED", eventType: "IMPORT_APPLIED", actorUserId, safeMetadata: { totalRows: job.totalRows, publishedRows: 0 } });
    return applied;
  });
}

