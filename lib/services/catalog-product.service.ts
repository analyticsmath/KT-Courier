import { prisma } from "@/lib/db/prisma";
import { validateProductAttributeValues } from "@/lib/catalog/product-attribute-validation";
import { evaluateCatalogCompliance } from "@/lib/catalog/catalog-compliance-policy";
import { assertProductTransition } from "@/lib/catalog/catalog-state-machines";
import { calculateCatalogQuality } from "@/lib/catalog/catalog-quality-score";
import { catalogPublicReference, catalogSlug, normalizeCatalogKey } from "@/lib/catalog/catalog-normalization";
import { productOptionFingerprint } from "@/lib/catalog/product-option-fingerprint";
import { CatalogConflictError, CatalogNotFoundError, CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";
import { toInputJsonObject } from "@/lib/json/input-json";

export type CatalogProductDraftInput = {
  scope: "GLOBAL_CANONICAL" | "STORE_PRIVATE";
  productTypeDefinitionId: string;
  primaryCategoryId: string;
  brandId?: string | null;
  title: string;
  shortDescription?: string;
  description?: string;
  manufacturer?: string;
  modelNumber?: string;
  countryOfOrigin?: string;
  condition: "NEW" | "REFURBISHED" | "RECONDITIONED" | "USED";
  attributeValues: Record<string, unknown>;
  complianceValues: Record<string, unknown>;
  slug?: string;
  operationId: string;
};

async function authoringFoundation(productTypeDefinitionId: string, categoryId: string) {
  const [definition, category] = await Promise.all([
    prisma.productTypeDefinition.findUnique({ where: { id: productTypeDefinitionId } }),
    prisma.catalogCategory.findUnique({ where: { id: categoryId } }),
  ]);
  if (!definition || !["APPROVED", "ACTIVE"].includes(definition.status)) {
    throw new CatalogPolicyError("PRODUCT_TYPE_UNAVAILABLE", "An approved product-type version is required for draft authoring.");
  }
  if (!category || category.status === "ARCHIVED") throw new CatalogPolicyError("CATEGORY_UNAVAILABLE", "An available category is required.");
  return { definition, category };
}

export async function listStoreCatalogProducts(storeId: string, filters: { page: number; pageSize: number; search?: string; status?: string }) {
  return prisma.catalogProduct.findMany({
    where: {
      sourceStoreId: storeId,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.search ? { OR: [{ title: { contains: filters.search, mode: "insensitive" } }, { publicReference: { contains: filters.search, mode: "insensitive" } }] } : {}),
    },
    include: { primaryCategory: { select: { name: true, path: true } }, productTypeDefinition: { select: { code: true, name: true, versionNumber: true } }, brand: { select: { name: true } }, variants: { select: { id: true, publicReference: true, title: true, status: true } }, offers: { where: { storeId }, select: { publicReference: true, status: true, publicationStatus: true } } },
    orderBy: { updatedAt: "desc" },
    skip: (filters.page - 1) * filters.pageSize,
    take: filters.pageSize,
  });
}

export async function getStoreCatalogProduct(storeId: string, publicReference: string) {
  const product = await prisma.catalogProduct.findFirst({
    where: { publicReference, OR: [{ scope: "STORE_PRIVATE", sourceStoreId: storeId }, { scope: "GLOBAL_CANONICAL", offers: { some: { storeId } } }] },
    include: { variants: { include: { optionValues: { include: { optionValue: { include: { option: true } } } }, media: true } }, options: { include: { values: true } }, media: { include: { asset: true } }, offers: { where: { storeId }, include: { priceVersions: { orderBy: { versionNumber: "desc" } }, inventoryItem: { include: { levels: { include: { location: true } } } } } }, primaryCategory: true, productTypeDefinition: true, brand: true },
  });
  if (!product) throw new CatalogNotFoundError("Catalog product was not found.");
  return product;
}

export async function createStorePrivateCatalogProduct(storeId: string, actorUserId: string, input: CatalogProductDraftInput) {
  if (input.scope !== "STORE_PRIVATE") throw new CatalogPolicyError("STORE_PRIVATE_REQUIRED", "Store authoring creates store-private products only.");
  const { definition } = await authoringFoundation(input.productTypeDefinitionId, input.primaryCategoryId);
  const attributeIssues = validateProductAttributeValues(definition.attributeSchema as never, input.attributeValues);
  if (attributeIssues.length > 0) throw new CatalogPolicyError("PRODUCT_ATTRIBUTES_INVALID", "Product attributes do not match the selected product type.");
  const publicReference = catalogPublicReference("CP");
  const variantReference = catalogPublicReference("CV");
  const slug = input.slug ?? catalogSlug(input.title);
  const quality = calculateCatalogQuality({
    requiredAttributesComplete: true,
    hasIdentifier: false,
    titleLength: input.title.length,
    descriptionLength: input.description?.length ?? 0,
    mediaCount: 0,
    allMediaHaveAltText: false,
    variantsComplete: true,
    complianceComplete: false,
    priceReady: false,
    inventoryReady: false,
  });
  return prisma.$transaction(async (tx) => {
    const product = await tx.catalogProduct.create({
      data: {
        publicReference,
        scope: "STORE_PRIVATE",
        sourceStoreId: storeId,
        productTypeDefinitionId: definition.id,
        productTypeVersionNumber: definition.versionNumber,
        primaryCategoryId: input.primaryCategoryId,
        brandId: input.brandId,
        title: input.title,
        normalizedTitle: normalizeCatalogKey(input.title),
        shortDescription: input.shortDescription,
        description: input.description,
        manufacturer: input.manufacturer,
        modelNumber: input.modelNumber,
        countryOfOrigin: input.countryOfOrigin,
        condition: input.condition,
        attributeValues: toInputJsonObject(input.attributeValues),
        complianceValues: toInputJsonObject(input.complianceValues),
        slug,
        qualityScore: quality.score,
        qualityIssues: quality.issues,
        createdByUserId: actorUserId,
        variants: { create: { publicReference: variantReference, title: "Default", normalizedTitle: "default", optionFingerprint: productOptionFingerprint([]), attributeValues: {}, status: "DRAFT" } },
      },
      include: { variants: true },
    });
    await recordCatalogEvidence(tx, { aggregateType: "PRODUCT", aggregateReference: publicReference, aggregateVersion: 1, action: "DRAFT_CREATED", eventType: "PRODUCT_UPDATED", actorUserId, safeMetadata: { scope: "STORE_PRIVATE" }, operation: { operationId: input.operationId, storeId, request: input } });
    return product;
  });
}

export async function updateStoreCatalogProduct(storeId: string, publicReference: string, actorUserId: string, input: Partial<CatalogProductDraftInput> & { version: number; operationId: string }) {
  const current = await prisma.catalogProduct.findUnique({ where: { publicReference }, include: { productTypeDefinition: true } });
  if (!current) throw new CatalogNotFoundError("Catalog product was not found.");
  if (current.scope !== "STORE_PRIVATE" || current.sourceStoreId !== storeId) throw new CatalogOwnershipError();
  if (!["DRAFT", "NEEDS_CHANGES"].includes(current.status)) throw new CatalogConflictError("PRODUCT_NOT_EDITABLE", "Only draft or needs-changes products can be edited.");
  const attributes = input.attributeValues ?? current.attributeValues;
  const attributeIssues = validateProductAttributeValues(current.productTypeDefinition.attributeSchema as never, attributes);
  if (attributeIssues.length > 0) throw new CatalogPolicyError("PRODUCT_ATTRIBUTES_INVALID", "Product attributes do not match the selected product type.");
  const nextVersion = current.version + 1;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.catalogProduct.updateMany({
      where: { id: current.id, version: input.version, sourceStoreId: storeId },
      data: {
        title: input.title,
        normalizedTitle: input.title ? normalizeCatalogKey(input.title) : undefined,
        shortDescription: input.shortDescription,
        description: input.description,
        brandId: input.brandId,
        manufacturer: input.manufacturer,
        modelNumber: input.modelNumber,
        countryOfOrigin: input.countryOfOrigin,
        condition: input.condition,
        attributeValues: input.attributeValues ? toInputJsonObject(input.attributeValues) : undefined,
        complianceValues: input.complianceValues ? toInputJsonObject(input.complianceValues) : undefined,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Product changed; reload before saving.");
    await recordCatalogEvidence(tx, { aggregateType: "PRODUCT", aggregateReference: publicReference, aggregateVersion: nextVersion, action: "DRAFT_UPDATED", eventType: "PRODUCT_UPDATED", actorUserId, operation: { operationId: input.operationId, storeId, request: input } });
    return tx.catalogProduct.findUniqueOrThrow({ where: { id: current.id }, include: { variants: true } });
  });
}

export async function submitStoreCatalogProduct(storeId: string, publicReference: string, actorUserId: string, input: { version: number; operationId: string }) {
  const current = await prisma.catalogProduct.findUnique({ where: { publicReference }, include: { primaryCategory: true, productTypeDefinition: true, variants: true, media: { include: { asset: true } } } });
  if (!current) throw new CatalogNotFoundError("Catalog product was not found.");
  if (current.sourceStoreId !== storeId) throw new CatalogOwnershipError();
  assertProductTransition(current.status, "SUBMITTED");
  if (current.variants.length < 1) throw new CatalogPolicyError("PRODUCT_VARIANT_REQUIRED", "At least one variant is required.");
  if (current.media.filter((item) => item.role === "PRIMARY" && item.variantId === null).length !== 1) throw new CatalogPolicyError("CATALOG_MEDIA_PRIMARY_REQUIRED", "Exactly one READY primary product image is required before submission.");
  if (current.media.some((item) => item.asset.status !== "READY")) throw new CatalogPolicyError("CATALOG_MEDIA_NOT_READY", "All attached product media must be READY before submission.");
  const complianceSchema = current.productTypeDefinition.complianceSchema as { requirements?: never[] };
  const compliance = evaluateCatalogCompliance({ categoryPath: current.primaryCategory.path, title: current.title, description: current.description, condition: current.condition, values: current.complianceValues as Record<string, unknown>, requirements: complianceSchema.requirements ?? [] });
  if (!compliance.allowed) throw new CatalogPolicyError("PRODUCT_COMPLIANCE_BLOCKED", `Product compliance is incomplete: ${compliance.blockingCodes.join(", ")}`);
  return prisma.$transaction(async (tx) => {
    const result = await tx.catalogProduct.updateMany({ where: { id: current.id, version: input.version, status: current.status }, data: { status: "SUBMITTED", moderationStatus: "PENDING", submittedByUserId: actorUserId, version: { increment: 1 } } });
    if (result.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Product changed; reload before submitting.");
    await tx.catalogModerationCase.create({ data: { publicReference: catalogPublicReference("CMC"), productId: current.id, type: "PRODUCT", reasonCode: "PRODUCT_SUBMISSION", safeSummary: "Product submitted for catalog review.", submittedByUserId: actorUserId } });
    await recordCatalogEvidence(tx, { aggregateType: "PRODUCT", aggregateReference: publicReference, aggregateVersion: current.version + 1, action: "SUBMITTED", eventType: "PRODUCT_UPDATED", actorUserId, operation: { operationId: input.operationId, storeId, request: input } });
    return tx.catalogProduct.findUniqueOrThrow({ where: { id: current.id } });
  });
}

export async function archiveStoreCatalogProduct(storeId: string, publicReference: string, actorUserId: string, input: { version: number; operationId: string }) {
  const current = await prisma.catalogProduct.findUnique({ where: { publicReference } });
  if (!current) throw new CatalogNotFoundError("Catalog product was not found.");
  if (current.sourceStoreId !== storeId) throw new CatalogOwnershipError();
  assertProductTransition(current.status, "ARCHIVED");
  return prisma.$transaction(async (tx) => {
    const result = await tx.catalogProduct.updateMany({ where: { id: current.id, version: input.version }, data: { status: "ARCHIVED", publicationStatus: "WITHDRAWN", version: { increment: 1 } } });
    if (result.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Product changed; reload before archiving.");
    await recordCatalogEvidence(tx, { aggregateType: "PRODUCT", aggregateReference: publicReference, aggregateVersion: current.version + 1, action: "ARCHIVED", eventType: "PRODUCT_UPDATED", actorUserId, operation: { operationId: input.operationId, storeId, request: input } });
    return tx.catalogProduct.findUniqueOrThrow({ where: { id: current.id } });
  });
}
