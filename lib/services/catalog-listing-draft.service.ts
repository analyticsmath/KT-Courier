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
      variants: { select: { publicReference: true, title: true } },
      offers: { where: { storeId }, select: {
        publicReference: true, storeSku: true, status: true, version: true,
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
  const requestHash = catalogRequestHash(input);
  return prisma.$transaction(async tx => {
    const lock = `${actorUserId}:${ACTION}:${input.operationId}`;
    await tx.$queryRaw`SELECT TRUE AS locked FROM pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
    const receipt = await tx.catalogOperationReceipt.findUnique({ where: { actorUserId_action_operationId: { actorUserId, action: ACTION, operationId: input.operationId } } });
    if (receipt) {
      if (receipt.storeId !== storeId || receipt.requestHash !== requestHash || !receipt.aggregateReference) throw new CatalogConflictError("OPERATION_REPLAY_MISMATCH", "This operation was already used for a different listing.");
      return confirmation(tx, storeId, receipt.aggregateReference);
    }
    const location = input.inventoryLocationPublicReference ? await tx.inventoryLocation.findFirst({ where: { publicReference: input.inventoryLocationPublicReference, storeId, status: "ACTIVE" } }) : null;
    if (input.inventoryLocationPublicReference && !location) throw new CatalogOwnershipError();
    const product = await createStorePrivateCatalogProduct(storeId, actorUserId, { ...input.product, operationId: `${input.operationId}:product` }, tx);
    for (const variant of input.variants) await createCatalogVariant({ storeId, actorUserId, productPublicReference: product.publicReference, ...variant }, tx);
    const offer = await createStoreCatalogOffer(storeId, actorUserId, {
      productId: product.id, variantId: product.variants[0].id, storeSku: input.storeSku,
      inventoryTrackingMode: "TRACKED", fulfilmentMode: "COURIER_DELIVERY", sellingUnit: "EACH",
      quantityStep: "1", minimumQuantity: "1", primaryInventoryLocationId: location?.id,
      operationId: `${input.operationId}:offer`,
    }, tx);
    await createStoreOfferPriceVersion(storeId, actorUserId, { ...input.price, offerPublicReference: offer.publicReference, offerVersion: offer.version, operationId: `${input.operationId}:price` }, tx);
    if (input.openingStock > 0 && location && offer.inventoryItem) await postCatalogInventoryMovement(storeId, actorUserId, offer.inventoryItem.publicReference, {
      type: "INITIAL_STOCK", quantityDelta: input.openingStock, locationPublicReference: location.publicReference,
      version: offer.inventoryItem.version, reasonCode: "OWNER_OPENING_STOCK", operationId: `${input.operationId}:stock`,
    }, tx);
    for (const [index, modifier] of input.modifiers.entries()) {
      const group = await createStoreModifierGroup(storeId, actorUserId, { ...modifier, operationId: `${input.operationId}:modifier:${index}` }, tx);
      await attachModifierGroup(storeId, offer.id, group.id, index, tx);
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
      safeMetadata: { offerReference: offer.publicReference }, operation: { operationId: input.operationId, storeId, request: input } });
    return confirmation(tx, storeId, product.publicReference);
  }, { timeout: 20_000 });
}
