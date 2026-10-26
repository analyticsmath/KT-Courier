import { type Prisma } from "@prisma/client";
import { parseProductCsv } from "@/lib/catalog/product-csv";
import { validateProductAttributeValues } from "@/lib/catalog/product-attribute-validation";
import { validateProductTypeAttributeSchema, type ProductTypeAttributeSchema } from "@/lib/catalog/product-type-schema";
import { CatalogProductCreateSchema } from "@/lib/validation/catalog";
import { createStorePrivateCatalogProduct } from "@/lib/services/catalog-product.service";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";
import { prisma } from "@/lib/db/prisma";
import { assertCatalogImportCanApply, assertCatalogImportCanValidate, assertCatalogImportFile } from "@/lib/catalog/catalog-import-policy";
import { catalogPublicReference, catalogRequestHash } from "@/lib/catalog/catalog-normalization";
import { CatalogConflictError, CatalogNotFoundError, CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";

export async function listStoreCatalogImports(storeId: string) {
  return prisma.catalogImportJob.findMany({ where: { storeId }, include: { rows: { take: 100, orderBy: { rowNumber: "asc" } } }, orderBy: { createdAt: "desc" }, take: 50 });
}

export async function createCatalogImportJob(storeId: string, actorUserId: string, input: { filename: string; mimeType: string; byteSize: number; templateVersion: number; operationId: string; csv?: string; productTypeDefinitionId?: string; primaryCategoryId?: string }) {
  assertCatalogImportFile(input);
  if (input.csv !== undefined) return ingestProductCsv(storeId, actorUserId, input);
  const requestHash = catalogRequestHash(input);
  const replay = await prisma.catalogImportJob.findUnique({ where: { storeId_operationId: { storeId, operationId: input.operationId } } });
  if (replay) {
    if (replay.requestHash !== requestHash) throw new CatalogConflictError("OPERATION_REPLAY_MISMATCH", "Operation ID was already used with different import metadata.");
    return replay;
  }
  return prisma.catalogImportJob.create({ data: { publicReference: catalogPublicReference("CIJ"), storeId, templateVersion: input.templateVersion, operationId: input.operationId, requestHash, filename: input.filename, createdByUserId: actorUserId } });
}

export async function validateCatalogImportJob(storeId: string, publicReference: string) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "CatalogImportJob" WHERE "publicReference" = ${publicReference} FOR UPDATE`;
    const job = await tx.catalogImportJob.findUnique({ where: { publicReference }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
    if (!job) throw new CatalogNotFoundError("Catalog import was not found.");
    if (job.storeId !== storeId) throw new CatalogOwnershipError();
    assertCatalogImportCanValidate({ status: job.status, rowStatuses: job.rows.map(row => row.status) });
    const validRows = job.rows.filter(row => row.status === "VALID").length;
    const invalidRows = job.rows.filter(row => row.status === "INVALID").length;
    return tx.catalogImportJob.update({ where: { id: job.id }, data: { status: "VALIDATED", dryRunCompleted: true, totalRows: job.rows.length, validRows, invalidRows, completedAt: new Date() }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
  });
}

export async function applyCatalogImportJob(storeId: string, actorUserId: string, publicReference: string) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "CatalogImportJob" WHERE "publicReference" = ${publicReference} FOR UPDATE`;
    const job = await tx.catalogImportJob.findUnique({ where: { publicReference }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
    if (!job) throw new CatalogNotFoundError("Catalog import was not found.");
    if (job.storeId !== storeId) throw new CatalogOwnershipError();
    if (job.status === "COMPLETED") {
      if (!job.rows.length || job.rows.length !== job.totalRows || job.validRows !== job.totalRows || job.invalidRows !== 0 || job.rows.some(row => row.status !== "APPLIED" || !row.resultingProductId)) throw new CatalogPolicyError("IMPORT_RECEIPT_INVALID", "Import confirmation is incomplete. Contact support.");
      return job;
    }
    assertCatalogImportCanApply(job);
    if (job.rows.length !== job.totalRows || job.rows.some(row => row.status !== "VALID")) throw new CatalogPolicyError("IMPORT_ROWS_INVALID", "All imported rows must be validated before apply.");
    const store = await tx.store.findFirst({ where: { id: storeId, status: { in: ["ACTIVE", "PENDING"] } }, select: { id: true } });
    if (!store) throw new CatalogOwnershipError();
    // All products and receipts commit together. A failed row rolls the entire batch back.
    for (const row of job.rows) {
      const parsed = CatalogProductCreateSchema.safeParse(row.normalizedPayload);
      if (!parsed.success || parsed.data.scope !== "STORE_PRIVATE") throw new CatalogPolicyError("IMPORT_PAYLOAD_INVALID", `Row ${row.rowNumber} must be uploaded and reviewed again.`);
      const product = await createStorePrivateCatalogProduct(storeId, actorUserId, parsed.data, tx);
      await tx.catalogImportRow.update({ where: { id: row.id }, data: { status: "APPLIED", resultingProductId: product.id } });
    }
    await recordCatalogEvidence(tx, { aggregateType: "IMPORT", aggregateReference: job.publicReference, aggregateVersion: 1, action: "DRAFTS_CREATED", eventType: "IMPORT_APPLIED", actorUserId, safeMetadata: { rowCount: job.rows.length, storeId } });
    return tx.catalogImportJob.update({ where: { id: job.id }, data: { status: "COMPLETED", completedAt: new Date() }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
  }, { timeout: 30_000 });
}

async function ingestProductCsv(storeId: string, actorUserId: string, input: { filename: string; mimeType: string; byteSize: number; templateVersion: number; operationId: string; csv?: string; productTypeDefinitionId?: string; primaryCategoryId?: string }) {
  if (!input.productTypeDefinitionId || !input.primaryCategoryId || input.csv === undefined) throw new CatalogPolicyError("IMPORT_FOUNDATION_REQUIRED", "Select a product type and category for this import.");
  if (Buffer.byteLength(input.csv, "utf8") !== input.byteSize) throw new CatalogPolicyError("IMPORT_SIZE_MISMATCH", "CSV byte size does not match the uploaded content.");
  const rows = parseProductCsv(input.csv);
  const requestHash = catalogRequestHash(input);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT TRUE AS locked FROM pg_advisory_xact_lock(hashtextextended(${`catalog-import:${storeId}:${input.operationId}`}, 0))`;
    const replay = await tx.catalogImportJob.findUnique({ where: { storeId_operationId: { storeId, operationId: input.operationId } }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
    if (replay) {
      if (replay.requestHash !== requestHash) throw new CatalogConflictError("OPERATION_REPLAY_MISMATCH", "This import operation was already used for different content.");
      return replay;
    }
    const [store, definition, category] = await Promise.all([
      tx.store.findFirst({ where: { id: storeId, status: { in: ["ACTIVE", "PENDING"] } }, select: { id: true } }),
      tx.productTypeDefinition.findUnique({ where: { id: input.productTypeDefinitionId! } }),
      tx.catalogCategory.findUnique({ where: { id: input.primaryCategoryId! }, include: { productTypeMappings: { include: { productTypeDefinition: { select: { code: true } } } } } }),
    ]);
    if (!store) throw new CatalogOwnershipError();
    if (!definition || !["APPROVED", "ACTIVE"].includes(definition.status) || validateProductTypeAttributeSchema(definition.attributeSchema).length || !category || category.status !== "ACTIVE") throw new CatalogPolicyError("IMPORT_FOUNDATION_UNAVAILABLE", "Choose an approved product type and active category.");
    if (category.productTypeMappings.length && !category.productTypeMappings.some(mapping => mapping.productTypeDefinition.code === definition.code)) throw new CatalogPolicyError("IMPORT_CATEGORY_TYPE_MISMATCH", "The product type does not belong to this category.");
    const reference = catalogPublicReference("CIJ");
    const prepared = rows.map(row => {
      const payload = { scope: "STORE_PRIVATE" as const, productTypeDefinitionId: definition.id, primaryCategoryId: category.id, title: row.title, ...(row.shortDescription ? { shortDescription: row.shortDescription } : {}), ...(row.description ? { description: row.description } : {}), condition: "NEW" as const, attributeValues: row.attributes, complianceValues: {}, operationId: `${reference}:${row.rowNumber}` };
      const issues = [...row.issues, ...validateProductAttributeValues(definition.attributeSchema as unknown as ProductTypeAttributeSchema, row.attributes).map(issue => `${issue.attributeCode}: ${issue.code}`)];
      const schema = CatalogProductCreateSchema.safeParse(payload);
      if (!schema.success) issues.push(...schema.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`));
      return { rowNumber: row.rowNumber, status: issues.length ? "INVALID" as const : "VALID" as const, normalizedPayload: payload as Prisma.InputJsonObject, errorCodes: issues };
    });
    return tx.catalogImportJob.create({ data: { publicReference: reference, storeId, templateVersion: input.templateVersion, operationId: input.operationId, requestHash, filename: input.filename, createdByUserId: actorUserId, totalRows: prepared.length, validRows: prepared.filter(row => row.status === "VALID").length, invalidRows: prepared.filter(row => row.status === "INVALID").length, rows: { create: prepared } }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
  }, { timeout: 30_000 });
}
