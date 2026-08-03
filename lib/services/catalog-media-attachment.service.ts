import { prisma } from "@/lib/db/prisma";
import { assertCatalogMediaAttachment } from "@/lib/catalog/media/catalog-media-attachment";
import { CatalogConflictError, CatalogNotFoundError, CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";

type AttachInput = Readonly<{ operationId: string; productVersion: number; assetPublicReference: string; role: "PRIMARY" | "GALLERY" | "VARIANT" | "SWATCH" | "LABEL"; altText: string; displayOrder: number; variantPublicReference?: string | null }>;

async function ownedDraftProduct(storeId: string, publicReference: string) {
  const product = await prisma.catalogProduct.findUnique({ where: { publicReference }, include: { variants: true, media: true } });
  if (!product) throw new CatalogNotFoundError("Catalog product was not found.");
  if (product.scope !== "STORE_PRIVATE" || product.sourceStoreId !== storeId) throw new CatalogOwnershipError();
  if (!["DRAFT", "NEEDS_CHANGES"].includes(product.status)) throw new CatalogPolicyError("CATALOG_MEDIA_PRODUCT_NOT_EDITABLE", "Media associations may only change on editable product drafts.", 409);
  return product;
}

export async function attachStoreCatalogMedia(storeId: string, productReference: string, actorUserId: string, input: AttachInput) {
  const product = await ownedDraftProduct(storeId, productReference);
  const asset = await prisma.catalogMediaAsset.findUnique({ where: { publicReference: input.assetPublicReference } });
  if (!asset) throw new CatalogNotFoundError("Catalog media asset was not found.");
  const variant = input.variantPublicReference ? product.variants.find((item) => item.publicReference === input.variantPublicReference) : null;
  if (input.variantPublicReference && !variant) throw new CatalogPolicyError("CATALOG_MEDIA_VARIANT_MISMATCH", "Variant media must reference a variant on the same product.");
  const existingVariantCount = variant ? product.media.filter((item) => item.variantId === variant.id).length : 0;
  if (product.media.some((item) => item.variantId === (variant?.id ?? null) && item.displayOrder === input.displayOrder)) throw new CatalogConflictError("CATALOG_MEDIA_ORDER_CONFLICT", "Media order is already occupied for this product or variant.");
  const primaryCount = product.media.filter((item) => item.role === "PRIMARY" && item.variantId === null).length + (input.role === "PRIMARY" && !variant ? 1 : 0);
  assertCatalogMediaAttachment({ product, variant, asset, role: input.role, altText: input.altText, existingProductImageCount: product.media.length, existingVariantImageCount: existingVariantCount, resultingPrimaryImageCount: primaryCount });
  return prisma.$transaction(async (tx) => {
    const versionUpdate = await tx.catalogProduct.updateMany({ where: { id: product.id, version: input.productVersion }, data: { version: { increment: 1 } } });
    if (versionUpdate.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Product changed; reload before attaching media.");
    const association = await tx.catalogProductMedia.create({ data: { productId: product.id, variantId: variant?.id, assetId: asset.id, role: input.role, altText: input.altText.trim(), displayOrder: input.displayOrder } });
    await recordCatalogEvidence(tx, { aggregateType: "PRODUCT", aggregateReference: product.publicReference, aggregateVersion: product.version + 1, action: "MEDIA_ATTACHED", eventType: "PRODUCT_UPDATED", actorUserId, safeMetadata: { assetReference: asset.publicReference, role: input.role }, operation: { operationId: input.operationId, storeId, request: input } });
    return { association, productVersion: product.version + 1 };
  });
}

export async function updateStoreCatalogMediaAssociation(storeId: string, productReference: string, associationId: string, actorUserId: string, input: Readonly<{ operationId: string; productVersion: number; altText: string; displayOrder: number; primary: boolean }>) {
  const product = await ownedDraftProduct(storeId, productReference);
  const association = product.media.find((item) => item.id === associationId);
  if (!association) throw new CatalogNotFoundError("Catalog media association was not found.");
  return prisma.$transaction(async (tx) => {
    const versionUpdate = await tx.catalogProduct.updateMany({ where: { id: product.id, version: input.productVersion }, data: { version: { increment: 1 } } });
    if (versionUpdate.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Product changed; reload before updating media.");
    if (input.primary) await tx.catalogProductMedia.updateMany({ where: { productId: product.id, variantId: null, role: "PRIMARY", id: { not: association.id } }, data: { role: "GALLERY" } });
    const updated = await tx.catalogProductMedia.update({ where: { id: association.id }, data: { altText: input.altText.trim(), displayOrder: input.displayOrder, ...(association.variantId ? {} : { role: input.primary ? "PRIMARY" : association.role === "PRIMARY" ? "GALLERY" : association.role }) } });
    await recordCatalogEvidence(tx, { aggregateType: "PRODUCT", aggregateReference: product.publicReference, aggregateVersion: product.version + 1, action: "MEDIA_ASSOCIATION_UPDATED", eventType: "PRODUCT_UPDATED", actorUserId, safeMetadata: { associationId }, operation: { operationId: input.operationId, storeId, request: input } });
    return { association: updated, productVersion: product.version + 1 };
  });
}

export async function removeStoreCatalogMediaAssociation(storeId: string, productReference: string, associationId: string, actorUserId: string, input: Readonly<{ operationId: string; productVersion: number }>) {
  const product = await ownedDraftProduct(storeId, productReference);
  const association = product.media.find((item) => item.id === associationId);
  if (!association) throw new CatalogNotFoundError("Catalog media association was not found.");
  return prisma.$transaction(async (tx) => {
    const versionUpdate = await tx.catalogProduct.updateMany({ where: { id: product.id, version: input.productVersion }, data: { version: { increment: 1 } } });
    if (versionUpdate.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Product changed; reload before removing media.");
    await tx.catalogProductMedia.delete({ where: { id: association.id } });
    await recordCatalogEvidence(tx, { aggregateType: "PRODUCT", aggregateReference: product.publicReference, aggregateVersion: product.version + 1, action: "MEDIA_ASSOCIATION_REMOVED", eventType: "PRODUCT_UPDATED", actorUserId, safeMetadata: { associationId, assetId: association.assetId }, operation: { operationId: input.operationId, storeId, request: input } });
    return { removedAssociationId: association.id, assetPreserved: true, productVersion: product.version + 1 };
  });
}
