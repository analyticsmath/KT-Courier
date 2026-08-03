import { prisma } from "@/lib/db/prisma";
import { assertOfferTransition } from "@/lib/catalog/catalog-state-machines";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { normalizeStoreSku } from "@/lib/catalog/product-identifiers";
import { CatalogConflictError, CatalogNotFoundError, CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";

export async function listStoreCatalogOffers(storeId: string, filters: { page: number; pageSize: number; search?: string; status?: string }) {
  return prisma.storeCatalogOffer.findMany({
    where: {
      storeId,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.search ? { OR: [{ storeSku: { contains: filters.search, mode: "insensitive" } }, { merchantTitle: { contains: filters.search, mode: "insensitive" } }, { product: { title: { contains: filters.search, mode: "insensitive" } } }] } : {}),
    },
    include: { product: { select: { publicReference: true, title: true, status: true, moderationStatus: true } }, variant: { select: { publicReference: true, title: true, gtin: true } }, priceVersions: { orderBy: { versionNumber: "desc" }, take: 1 }, inventoryItem: { include: { levels: true } } },
    orderBy: { updatedAt: "desc" },
    skip: (filters.page - 1) * filters.pageSize,
    take: filters.pageSize,
  });
}

export async function getStoreCatalogOffer(storeId: string, publicReference: string) {
  const offer = await prisma.storeCatalogOffer.findFirst({ where: { storeId, publicReference }, include: { product: true, variant: true, priceVersions: { orderBy: { versionNumber: "desc" } }, inventoryItem: { include: { levels: { include: { location: true } }, movements: { orderBy: { createdAt: "desc" }, take: 50 } } }, modifierGroups: { include: { group: { include: { options: true } } } } } });
  if (!offer) throw new CatalogNotFoundError("Store catalog offer was not found.");
  return offer;
}

export async function createStoreCatalogOffer(storeId: string, actorUserId: string, input: {
  productId: string;
  variantId: string;
  storeSku: string;
  merchantTitle?: string;
  merchantDescription?: string;
  inventoryTrackingMode: "TRACKED" | "UNTRACKED" | "MADE_TO_ORDER";
  fulfilmentMode: "COURIER_DELIVERY" | "STORE_PICKUP" | "PICKUP_AND_DELIVERY";
  sellingUnit: "EACH" | "FIXED_WEIGHT" | "VARIABLE_WEIGHT" | "VOLUME" | "LENGTH";
  quantityStep: string;
  minimumQuantity: string;
  primaryInventoryLocationId?: string;
  operationId: string;
}) {
  const [product, variant, location] = await Promise.all([
    prisma.catalogProduct.findUnique({ where: { id: input.productId } }),
    prisma.catalogProductVariant.findUnique({ where: { id: input.variantId } }),
    input.primaryInventoryLocationId ? prisma.inventoryLocation.findFirst({ where: { id: input.primaryInventoryLocationId, storeId, status: "ACTIVE" } }) : null,
  ]);
  if (!product || !variant || variant.productId !== product.id) throw new CatalogPolicyError("OFFER_PRODUCT_VARIANT_MISMATCH", "Offer variant must belong to the selected product.");
  if (product.scope === "STORE_PRIVATE" && product.sourceStoreId !== storeId) throw new CatalogOwnershipError();
  if (variant.status === "ARCHIVED") throw new CatalogPolicyError("VARIANT_ARCHIVED", "Archived variants cannot receive offers.");
  if (input.primaryInventoryLocationId && !location) throw new CatalogOwnershipError();
  const publicReference = catalogPublicReference("CO");
  const inventoryReference = catalogPublicReference("CII");
  return prisma.$transaction(async (tx) => {
    const offer = await tx.storeCatalogOffer.create({
      data: {
        publicReference,
        storeId,
        productId: product.id,
        variantId: variant.id,
        storeSku: normalizeStoreSku(input.storeSku),
        merchantTitle: input.merchantTitle,
        merchantDescription: input.merchantDescription,
        inventoryTrackingMode: input.inventoryTrackingMode,
        fulfilmentMode: input.fulfilmentMode,
        sellingUnit: input.sellingUnit,
        quantityStep: input.quantityStep,
        minimumQuantity: input.minimumQuantity,
        primaryInventoryLocationId: input.primaryInventoryLocationId,
        createdByUserId: actorUserId,
        inventoryItem: { create: { publicReference: inventoryReference, variantId: variant.id, trackingMode: input.inventoryTrackingMode } },
      },
      include: { inventoryItem: true },
    });
    await recordCatalogEvidence(tx, { aggregateType: "OFFER", aggregateReference: publicReference, aggregateVersion: 1, action: "DRAFT_CREATED", eventType: "OFFER_UPDATED", actorUserId, safeMetadata: { productReference: product.publicReference, variantReference: variant.publicReference }, operation: { operationId: input.operationId, storeId, request: input } });
    return offer;
  });
}

export async function updateStoreCatalogOffer(storeId: string, publicReference: string, actorUserId: string, input: {
  version: number;
  merchantTitle?: string | null;
  merchantDescription?: string | null;
  fulfilmentMode?: "COURIER_DELIVERY" | "STORE_PICKUP" | "PICKUP_AND_DELIVERY";
  primaryInventoryLocationId?: string | null;
  operationId: string;
}) {
  const current = await prisma.storeCatalogOffer.findUnique({ where: { publicReference } });
  if (!current) throw new CatalogNotFoundError("Store catalog offer was not found.");
  if (current.storeId !== storeId) throw new CatalogOwnershipError();
  if (!["DRAFT", "NEEDS_CHANGES", "PAUSED"].includes(current.status)) throw new CatalogConflictError("OFFER_NOT_EDITABLE", "Offer is not editable in its current state.");
  if (input.primaryInventoryLocationId) {
    const location = await prisma.inventoryLocation.findFirst({ where: { id: input.primaryInventoryLocationId, storeId, status: "ACTIVE" } });
    if (!location) throw new CatalogOwnershipError();
  }
  const { version, operationId, ...offerData } = input;
  return prisma.$transaction(async (tx) => {
    const result = await tx.storeCatalogOffer.updateMany({ where: { id: current.id, storeId, version }, data: { ...offerData, version: { increment: 1 } } });
    if (result.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Offer changed; reload before saving.");
    await recordCatalogEvidence(tx, { aggregateType: "OFFER", aggregateReference: publicReference, aggregateVersion: current.version + 1, action: "DRAFT_UPDATED", eventType: "OFFER_UPDATED", actorUserId, operation: { operationId, storeId, request: input } });
    return tx.storeCatalogOffer.findUniqueOrThrow({ where: { id: current.id } });
  });
}

export async function transitionStoreCatalogOffer(storeId: string, publicReference: string, actorUserId: string, toStatus: "SUBMITTED" | "PAUSED" | "ARCHIVED", input: { version: number; operationId: string }) {
  const current = await prisma.storeCatalogOffer.findUnique({ where: { publicReference }, include: { product: true, priceVersions: true, inventoryItem: { include: { levels: true } } } });
  if (!current) throw new CatalogNotFoundError("Store catalog offer was not found.");
  if (current.storeId !== storeId) throw new CatalogOwnershipError();
  assertOfferTransition(current.status, toStatus);
  if (toStatus === "SUBMITTED" && !current.priceVersions.some((price) => ["DRAFT", "SCHEDULED", "ACTIVE"].includes(price.status))) {
    throw new CatalogPolicyError("OFFER_PRICE_REQUIRED", "Offer submission requires a valid price version.");
  }
  const publicationStatus = toStatus === "ARCHIVED" ? "WITHDRAWN" : current.publicationStatus;
  return prisma.$transaction(async (tx) => {
    const result = await tx.storeCatalogOffer.updateMany({ where: { id: current.id, storeId, version: input.version }, data: { status: toStatus, publicationStatus, submittedByUserId: toStatus === "SUBMITTED" ? actorUserId : undefined, version: { increment: 1 } } });
    if (result.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Offer changed; reload before continuing.");
    if (toStatus === "SUBMITTED") await tx.catalogModerationCase.create({ data: { publicReference: catalogPublicReference("CMC"), offerId: current.id, type: "OFFER", reasonCode: "OFFER_SUBMISSION", safeSummary: "Store offer submitted for catalog review.", submittedByUserId: actorUserId } });
    await recordCatalogEvidence(tx, { aggregateType: "OFFER", aggregateReference: publicReference, aggregateVersion: current.version + 1, action: toStatus, eventType: "OFFER_UPDATED", actorUserId, operation: { operationId: input.operationId, storeId, request: { ...input, toStatus } } });
    return tx.storeCatalogOffer.findUniqueOrThrow({ where: { id: current.id } });
  });
}
