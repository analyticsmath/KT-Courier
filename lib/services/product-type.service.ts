import { prisma } from "@/lib/db/prisma";
import { assertCatalogProductionActivationAllowed } from "@/lib/catalog/catalog-production-lock";
import { assertProductTypeTransition } from "@/lib/catalog/catalog-state-machines";
import { assertProductTypeSchemaBundle } from "@/lib/catalog/product-type-schema";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { CatalogConflictError, CatalogNotFoundError } from "@/lib/catalog/errors";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";

export async function listProductTypeDefinitions() {
  return prisma.productTypeDefinition.findMany({ orderBy: [{ code: "asc" }, { versionNumber: "desc" }] });
}

export async function createProductTypeDefinition(args: {
  actorUserId: string;
  code: string;
  name: string;
  description?: string;
  versionNumber: number;
  schemaVersion: number;
  attributeSchema: Record<string, unknown>;
  variantSchema: Record<string, unknown>;
  complianceSchema: Record<string, unknown>;
  searchFacetSchema: Record<string, unknown>;
  supersedesDefinitionId?: string;
  operationId: string;
}) {
  assertProductTypeSchemaBundle(args);
  const publicReference = catalogPublicReference("PT");
  const { actorUserId, operationId, ...definitionData } = args;
  return prisma.$transaction(async (tx) => {
    const definition = await tx.productTypeDefinition.create({ data: { publicReference, createdByUserId: actorUserId, ...definitionData } as any });
    await recordCatalogEvidence(tx, { aggregateType: "PRODUCT_TYPE", aggregateReference: publicReference, aggregateVersion: 1, action: "CREATED", eventType: "PRODUCT_TYPE_UPDATED", actorUserId, operation: { operationId, request: args } });
    return definition;
  });
}

export async function updateProductTypeDefinition(id: string, args: {
  actorUserId: string;
  version: number;
  name?: string;
  description?: string;
  schemaVersion?: number;
  attributeSchema?: Record<string, unknown>;
  variantSchema?: Record<string, unknown>;
  complianceSchema?: Record<string, unknown>;
  searchFacetSchema?: Record<string, unknown>;
  supersedesDefinitionId?: string;
  operationId: string;
}) {
  const current = await prisma.productTypeDefinition.findUnique({ where: { id } });
  if (!current) throw new CatalogNotFoundError("Product type was not found.");
  if (current.status !== "DRAFT") throw new CatalogConflictError("PRODUCT_TYPE_IMMUTABLE", "Only draft product-type definitions can be edited.");
  const { actorUserId, version, operationId, ...definitionData } = args;
  assertProductTypeSchemaBundle({
    attributeSchema: args.attributeSchema ?? current.attributeSchema,
    variantSchema: args.variantSchema ?? current.variantSchema,
    complianceSchema: args.complianceSchema ?? current.complianceSchema,
    searchFacetSchema: args.searchFacetSchema ?? current.searchFacetSchema,
  });
  return prisma.$transaction(async (tx) => {
    const result = await tx.productTypeDefinition.updateMany({ where: { id, version, status: "DRAFT" }, data: { ...definitionData, version: { increment: 1 } } as any });
    if (result.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Product type changed; reload before saving.");
    await recordCatalogEvidence(tx, { aggregateType: "PRODUCT_TYPE", aggregateReference: current.publicReference, aggregateVersion: current.version + 1, action: "UPDATED", eventType: "PRODUCT_TYPE_UPDATED", actorUserId, operation: { operationId, request: args } });
    return tx.productTypeDefinition.findUniqueOrThrow({ where: { id } });
  });
}

export async function transitionProductTypeDefinition(id: string, toStatus: "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "RETIRED", args: { actorUserId: string; version: number; operationId: string }) {
  const current = await prisma.productTypeDefinition.findUnique({ where: { id } });
  if (!current) throw new CatalogNotFoundError("Product type was not found.");
  assertProductTypeTransition(current.status, toStatus);
  if (toStatus === "ACTIVE") assertCatalogProductionActivationAllowed("PRODUCT_TYPE");
  const actorData = toStatus === "UNDER_REVIEW" ? { submittedByUserId: args.actorUserId } : toStatus === "APPROVED" ? { approvedByUserId: args.actorUserId } : {};
  const lifecycle = toStatus === "ACTIVE" ? { activatedAt: new Date() } : toStatus === "RETIRED" ? { retiredAt: new Date() } : {};
  return prisma.$transaction(async (tx) => {
    const result = await tx.productTypeDefinition.updateMany({ where: { id, version: args.version }, data: { status: toStatus, ...actorData, ...lifecycle, version: { increment: 1 } } });
    if (result.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Product type changed; reload before continuing.");
    await recordCatalogEvidence(tx, { aggregateType: "PRODUCT_TYPE", aggregateReference: current.publicReference, aggregateVersion: current.version + 1, action: toStatus, eventType: "PRODUCT_TYPE_UPDATED", actorUserId: args.actorUserId, operation: { operationId: args.operationId, request: { id, toStatus, version: args.version } } });
    return tx.productTypeDefinition.findUniqueOrThrow({ where: { id } });
  });
}
