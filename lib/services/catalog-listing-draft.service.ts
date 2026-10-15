import { prisma } from "@/lib/db/prisma";
import { type Prisma } from "@prisma/client";
import { CatalogListingDraftSchema, type CatalogListingDraftInput } from "@/lib/validation/catalog-listing-draft";
import { catalogRequestHash } from "@/lib/catalog/catalog-normalization";
import { CatalogConflictError, CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";
import { createStorePrivateCatalogProduct } from "./catalog-product.service";
import { createCatalogVariant } from "./catalog-variant.service";
import { createStoreCatalogOffer } from "./store-offer.service";
import { createStoreOfferPriceVersion } from "./store-price.service";
import { postCatalogInventoryMovement } from "./catalog-inventory.service";
import { createStoreModifierGroup, attachModifierGroup } from "./catalog-modifier.service";
import { attachStoreCatalogMedia } from "./catalog-media-attachment.service";
import { recordCatalogEvidence } from "./catalog-service-support";

const ACTION = "PRODUCT:LISTING_DRAFT_CREATED";
async function confirmation(tx: Prisma.TransactionClient, storeId: string, publicReference: string) {
  return tx.catalogProduct.findFirstOrThrow({
    where: { sourceStoreId: storeId, scope: "STORE_PRIVATE", publicReference },
    select: {
      publicReference: true, version: true, status: true,
      variants: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { publicReference: true, title: true, optionValues: { select: { optionValue: { select: { label: true, option: { select: { code: true } } } } } } } },
      offers: { where: { storeId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: {
        publicReference: true, storeSku: true, status: true, version: true,
        variant: { select: { publicReference: true, title: true } },
        priceVersions: { select: { publicReference: true, amount: true, currency: true, status: true } },
        inventoryItem: { select: { publicReference: true, levels: { select: { onHand: true, reserved: true, available: true } } } },
        modifierGroups: { select: { group: { select: { publicReference: true, name: true } } } },
      } },
    },
  });
}

/** Save listing facts with existing canonical commands; approval/publication stay separate. */
export async function createStoreCatalogListingDraft(storeId: string, actorUserId: string, raw: CatalogListingDraftInput) {
  const parsed = CatalogListingDraftSchema.safeParse(raw);
  if (!parsed.success) throw new CatalogPolicyError("LISTING_DRAFT_INVALID", "Review the listing fields before saving.");
  const input = parsed.data;
  // Commercial fields are explicit for every custom variant. The original
  // top-level fields continue to describe only the single Default path.
  const single = input.variants.length === 0 && input.storeSku && input.price && input.openingStock !== undefined
    ? { storeSku: input.storeSku, price: input.price, openingStock: input.openingStock, inventoryLocationPublicReference: input.inventoryLocationPublicReference }
    : null;
  if (input.variants.length === 0 && !single) throw new CatalogPolicyError("LISTING_DRAFT_INVALID", "A single-variant listing requires SKU, price and stock.");
  const requestHash = catalogRequestHash(input);
  return prisma.$transaction(async tx => {
    const lock = `${actorUserId}:${ACTION}:${input.operationId}`;
    await tx.$queryRaw`SELECT TRUE AS locked FROM pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
    const receipt = await tx.catalogOperationReceipt.findUnique({ where: { actorUserId_action_operationId: { actorUserId, action: ACTION, operationId: input.operationId } } });
    if (receipt) {
      if (receipt.storeId !== storeId || receipt.requestHash !== requestHash || !receipt.aggregateReference) throw new CatalogConflictError("OPERATION_REPLAY_MISMATCH", "This operation was already used for a different listing.");
      return confirmation(tx, storeId, receipt.aggregateReference);
    }
    const locationReferences = new Set([input.inventoryLocationPublicReference, ...input.variants.map(variant => variant.inventoryLocationPublicReference)].filter((reference): reference is string => Boolean(reference)));
    const locations = new Map<string, { id: string; publicReference: string }>();
    for (const publicReference of locationReferences) {
      const location = await tx.inventoryLocation.findFirst({ where: { publicReference, storeId, status: "ACTIVE" }, select: { id: true, publicReference: true } });
      if (!location) throw new CatalogOwnershipError();
      locations.set(publicReference, location);
    }
    const product = await createStorePrivateCatalogProduct(storeId, actorUserId, { ...input.product, operationId: `${input.operationId}:product` }, tx);
    const sellable: Array<{ variantId: string; storeSku: string; price: NonNullable<typeof input.price>; openingStock: number; inventoryLocationPublicReference?: string }> = [];
    if (single) sellable.push({ variantId: product.variants[0].id, ...single });
    else {
      // Product creation supplies an unused Default record. Custom listings
      // replace that transaction-local placeholder with their exact choices.
      await tx.catalogProductVariant.delete({ where: { id: product.variants[0].id } });
      for (const { storeSku, price, openingStock, inventoryLocationPublicReference, ...definition } of input.variants) {
        const variant = await createCatalogVariant({ storeId, actorUserId, productPublicReference: product.publicReference, ...definition }, tx);
        sellable.push({ variantId: variant.id, storeSku, price, openingStock, inventoryLocationPublicReference: inventoryLocationPublicReference ?? input.inventoryLocationPublicReference });
      }
    }
    const offers = [];
    for (const [index, item] of sellable.entries()) {
      const operationPrefix = single ? input.operationId : `${input.operationId}:variant:${index}`;
      const location = item.inventoryLocationPublicReference ? locations.get(item.inventoryLocationPublicReference) : undefined;
      const offer = await createStoreCatalogOffer(storeId, actorUserId, {
        productId: product.id, variantId: item.variantId, storeSku: item.storeSku,
        inventoryTrackingMode: "TRACKED", fulfilmentMode: "COURIER_DELIVERY", sellingUnit: "EACH",
        quantityStep: "1", minimumQuantity: "1", primaryInventoryLocationId: location?.id, operationId: `${operationPrefix}:offer`,
      }, tx);
      offers.push(offer);
      await createStoreOfferPriceVersion(storeId, actorUserId, { ...item.price, offerPublicReference: offer.publicReference, offerVersion: offer.version, operationId: `${operationPrefix}:price` }, tx);
      if (item.openingStock > 0 && location && offer.inventoryItem) await postCatalogInventoryMovement(storeId, actorUserId, offer.inventoryItem.publicReference, {
        type: "INITIAL_STOCK", quantityDelta: item.openingStock, locationPublicReference: location.publicReference,
        version: offer.inventoryItem.version, reasonCode: "OWNER_OPENING_STOCK", operationId: `${operationPrefix}:stock`,
      }, tx);
    }
    for (const [index, modifier] of input.modifiers.entries()) {
      const group = await createStoreModifierGroup(storeId, actorUserId, { ...modifier, operationId: `${input.operationId}:modifier:${index}` }, tx);
      for (const offer of offers) await attachModifierGroup(storeId, offer.id, group.id, index, tx);
    }
    let productVersion = product.version;
    for (const media of input.media) {
      const result = await attachStoreCatalogMedia(storeId, product.publicReference, actorUserId, {
        assetPublicReference: media.assetPublicReference, altText: media.altText, displayOrder: media.displayOrder,
        role: media.variantAssociation === "DEFAULT" ? "VARIANT" : media.primary ? "PRIMARY" : "GALLERY",
        variantPublicReference: media.variantAssociation === "DEFAULT" ? product.variants[0].publicReference : null,
        productVersion, operationId: `${input.operationId}:media:${media.displayOrder}`,
      }, tx);
      productVersion = result.productVersion;
    }
    const completed = await tx.catalogProduct.update({ where: { id: product.id }, data: { version: { increment: 1 } }, select: { version: true } });
    await recordCatalogEvidence(tx, { aggregateType: "PRODUCT", aggregateReference: product.publicReference, aggregateVersion: completed.version,
      action: "LISTING_DRAFT_CREATED", eventType: "PRODUCT_UPDATED", actorUserId,
      safeMetadata: { offerReference: offers[0].publicReference, offerReferences: offers.map(offer => offer.publicReference) }, operation: { operationId: input.operationId, storeId, request: input } });
    return confirmation(tx, storeId, product.publicReference);
  }, { timeout: 20_000 });
}
