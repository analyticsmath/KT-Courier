import { prisma } from "@/lib/db/prisma";
import { assertCatalogImportCanApply, assertCatalogImportCanValidate, assertCatalogImportFile } from "@/lib/catalog/catalog-import-policy";
import { catalogPublicReference, catalogRequestHash } from "@/lib/catalog/catalog-normalization";
import { CatalogConflictError, CatalogNotFoundError, CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";

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
  return prisma.catalogImportJob.create({ data: { publicReference: catalogPublicReference("CIJ"), storeId, templateVersion: input.templateVersion, operationId: input.operationId, requestHash, filename: i¶»§q«^