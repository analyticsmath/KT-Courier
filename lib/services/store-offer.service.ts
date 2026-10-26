import { prisma } from "@/lib/db/prisma";
import { validatePackUnit } from "@/lib/catalog/volume-pricing";
import { type Prisma } from "@prisma/client";
import { assertOfferTransition } from "@/lib/catalog/catalog-state-machines";
import { catalogPublicReference, catalogRequestHash } from "@/lib/catalog/catalog-normalization";
import { normalizeStoreSku } from "@/lib/catalog/product-identifiers";
import { CatalogConflictError, CatalogNotFoundError, CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";
import { recordCatalogEvidence, withCatalogTransaction } from "@/lib/services/catalog-service-support";
import { StorefrontProjectionService } from "@/lib/services/storefront-projection.service";

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
  sellingUnit: "EACH" | "PAIR" | "PACK" | "BULK" | "FIXED_WEIGHT" | "VARIABLE_WEIGHT" | "VOLUME" | "LENGTH";
  quantityStep: string;
  minimumQuantity: string;
  packagedQuantity?: string;
  unitOfMeasure?: string;
  primaryInventoryLocationId?: string;
  operationId: string;
}, transaction?: Prisma.TransactionClient) {
  const database = transaction ?? prisma;
  const packageInfo=validatePackUnit(input.sellingUnit,input.packagedQuantity,input.unitOfMeasure);
  if (["PAIR", "PACK", "BULK"].includes(input.sellingUnit) &&
      (!/^\d+$/.test(input.quantityStep) || !/^\d+$/.test(input.minimumQuantity) ||
        Number(input.quantityStep) !== 1 || Number(input.minimumQuantity) < 1))
    throw new CatalogPolicyError("PACKAGE_QUANTITY_INVALID", "Packs must be sold as whole, independently inventoried SKU quantities.");
  const [product, variant, location] = await Promise.all([
    database.catalogProduct.findUnique({ where: { id: input.productId } }),
    database.catalogProductVariant.findUnique({ where: { id: input.variantId } }),
    input.primaryInventoryLocationId ? database.inventoryLocation.findFirst({ where: { id: input.primaryInventoryLocationId, storeId, status: "ACTIVE" } }) : null,
  ]);
  if (!product || !variant || variant.productId !== product.id) throw new CatalogPolicyError("OFFER_PRODUCT_VARIANT_MISMATCH", "Offer variant must belong to the selected product.");
  if (product.scope === "STORE_PRIVATE" && product.sourceStoreId !== storeId) throw new CatalogOwnershipError();
  if (variant.status === "ARCHIVED") throw new CatalogPolicyError("VARIANT_ARCHIVED", "Archived variants cannot receive offers.");
  if (input.primaryInventoryLocationId && !location) throw new CatalogOwnershipError();
  const publicReference = catalogPublicReference("CO");
  const inventoryReference = catalogPublicReference("CII");
  return withCatalogTransaction(transaction, async (tx) => {
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
        packagedQuantity:packageInfo.packagedQuantity,
        unitOfMeasure:packageInfo.unitOfMeasure,
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
  const current = await prisma.storeCatalogOffer.findFirst({ where: { publicReference, storeId } });
  if (!current) {
    const exists = await prisma.storeCatalogOffer.findUnique({ where: { publicReference }, select: { storeId: true } });
    if (exists && exists.storeId !== storeId) throw new CatalogOwnershipError();
    throw new CatalogNotFoundError("Store catalog offer was not found.");
  }
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

export async function transitionStoreCatalogOffer(storeId: string, publicReference: string, actorUserId: string, toStatus: "SUBMITTED" | "PAUSED" | "ARCHIVED" | "ACTIVE", input: { version: number; operationId: string }) {
  const request = { ...input, toStatus };
  const requestHash = catalogRequestHash(request);
  return prisma.$transaction(async tx => {
    const key = `${actorUserId}:offer-transition:${input.operationId}`;
    await tx.$queryRaw`SELECT TRUE AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    const current = await tx.storeCatalogOffer.findFirst({ where: { publicReference, storeId }, include: { priceVersions: true } });
    if (!current) {
      const foreign = await tx.storeCatalogOffer.findUnique({ where: { publicReference }, select: { storeId: true } });
      if (foreign && foreign.storeId !== storeId) throw new CatalogOwnershipError();
      throw new CatalogNotFoundError("Store catalog offer was not found.");
    }
    const receipt = await tx.catalogOperationReceipt.findUnique({ where: { actorUserId_action_operationId: { actorUserId, action: `OFFER:${toStatus}`, operationId: input.operationId } } });
    if (receipt) {
      if (receipt.storeId !== storeId || receipt.aggregateReference !== publicReference || receipt.requestHash !== requestHash) throw new CatalogConflictError("OPERATION_REPLAY_MISMATCH", "This operation was used for different offer facts.");
      return tx.storeCatalogOffer.findUniqueOrThrow({ where: { id: current.id } });
    }
    if (current.version !== input.version) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Offer changed; reload before continuing.");
    if (toStatus === "ACTIVE" && current.status !== "PAUSED") throw new CatalogConflictError("OFFER_NOT_PAUSED", "Only a paused offer can be resumed. Other offers must follow catalog review.");
    assertOfferTransition(current.status, toStatus);
    if (toStatus === "SUBMITTED" && !current.priceVersions.some(price => ["DRAFT", "SCHEDULED", "ACTIVE"].includes(price.status))) throw new CatalogPolicyError("OFFER_PRICE_REQUIRED", "Offer submission requires a valid price version.");
    const result = await tx.storeCatalogOffer.updateMany({ where: { id: current.id, storeId, version: input.version, status: current.status }, data: { status: toStatus, publicationStatus: toStatus === "ARCHIVED" ? "WITHDRAWN" : current.publicationStatus, submittedByUserId: toStatus === "SUBMITTED" ? actorUserId : undefined, version: { increment: 1 } } });
    if (result.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Offer changed; reload before continuing.");
    if (toStatus === "PAUSED" || toStatus === "ARCHIVED") await new StorefrontProjectionService(tx).withdrawOffer(publicReference);
    if (toStatus === "ACTIVE" && current.publicationStatus === "PUBLISHED") {
      const snapshot = await tx.catalogPublicationSnapshot.findFirst({ where: { offerId: current.id, status: "PUBLISHED", supersededAt: null }, orderBy: { versionNumber: "desc" }, select: { publicReference: true } });
      if (!snapshot) throw new CatalogPolicyError("OFFER_PUBLICATION_EVIDENCE_MISSING", "The listing cannot resume without its approved publication evidence. Contact catalog support.");
      await new StorefrontProjectionService(tx).buildPublishedSnapshot(snapshot.publicReference);
    }
    if (toStatus === "SUBMITTED") await tx.catalogModerationCase.create({ data: { publicReference: catalogPublicReference("CMC"), offerId: current.id, type: "OFFER", reasonCode: "OFFER_SUBMISSION", safeSummary: "Store offer submitted for catalog review.", submittedByUserId: actorUserId } });
    await recordCatalogEvidence(tx, { aggregateType: "OFFER", aggregateReference: publicReference, aggregateVersion: current.version + 1, action: toStatus, eventType: "OFFER_UPDATED", actorUserId, operation: { operationId: input.operationId, storeId, request } });
    return tx.storeCatalogOffer.findUniqueOrThrow({ where: { id: current.id } });
  });
}
