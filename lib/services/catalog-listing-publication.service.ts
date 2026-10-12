import { prisma } from "@/lib/db/prisma";
import { catalogRequestHash } from "@/lib/catalog/catalog-normalization";
import { assertCatalogProductionActivationAllowed } from "@/lib/catalog/catalog-production-lock";
import { CatalogConflictError, CatalogNotFoundError, CatalogPolicyError } from "@/lib/catalog/errors";
import { CatalogListingPublishSchema, type CatalogListingPublishInput } from "@/lib/validation/catalog-publication";
import { recordCatalogEvidence } from "./catalog-service-support";
import { rebuildCatalogPublicationSnapshot } from "./catalog-publication.service";
import { StorefrontProjectionService } from "./storefront-projection.service";
import { rebuildStorefrontStoreDocument } from "./storefront-store.service";
import { rebuildStorefrontCategoryDocument } from "./storefront-category.service";

/** Publishes independently reviewed vendor goods; never activates delivery or financial policy. */
export async function publishApprovedCatalogListing(offerId: string, actorUserId: string, raw: CatalogListingPublishInput) {
  const input = CatalogListingPublishSchema.parse(raw);
  assertCatalogProductionActivationAllowed("PUBLICATION");
  const request = { offerId, ...input }; const hash = catalogRequestHash(request);
  return prisma.$transaction(async tx => {
    const key = `${actorUserId}:listing-publication:${input.operationId}`;
    await tx.$queryRaw`SELECT TRUE AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    const offerSource = await tx.storeCatalogOffer.findUnique({ where: { id: offerId }, select: { storeId: true, productId: true } });
    if (!offerSource) throw new CatalogNotFoundError("Catalog offer was not found.");
    // Store/product locks serialize publication with stock setup and independent moderation.
    await tx.$queryRaw`SELECT "id" FROM "Store" WHERE "id" = ${offerSource.storeId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "CatalogProduct" WHERE "id" = ${offerSource.productId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "StoreCatalogOffer" WHERE "id" = ${offerId} FOR UPDATE`;
    const actor = await tx.user.findUnique({ where: { id: actorUserId }, select: { role: true, status: true } });
    if (actor?.status !== "ACTIVE" || !["ADMIN", "SUPER_ADMIN"].includes(actor.role)) throw new CatalogPolicyError("CATALOG_PUBLICATION_DENIED", "An active catalog administrator is required.", 403);
    const receipt = await tx.catalogOperationReceipt.findUnique({ where: { actorUserId_action_operationId: { actorUserId, action: "OFFER:LISTING_PUBLISHED", operationId: input.operationId } } });
    if (receipt) {
      if (receipt.requestHash !== hash || !receipt.aggregateReference) throw new CatalogConflictError("OPERATION_REPLAY_MISMATCH", "This operation was used for different publication facts.");
      const snapshot = await tx.catalogPublicationSnapshot.findFirstOrThrow({ where: { offerId, publicReference: receipt.aggregateReference }, select: { publicReference: true, publicationVersion: true, status: true } });
      const current = await tx.storeCatalogOffer.findUniqueOrThrow({ where: { id: offerId }, select: { status: true, publicationStatus: true, version: true } });
      return { snapshot, offer: current, replayed: true };
    }
    const offer = await tx.storeCatalogOffer.findUniqueOrThrow({ where: { id: offerId }, include: { store: true, product: { include: { productTypeDefinition: true, primaryCategory: true, media: { include: { asset: true } } } }, variant: true } });
    const price = await tx.storeOfferPriceVersion.findFirst({ where: { offerId, publicReference: input.priceVersionReference } });
    if (offer.version !== input.version || offer.product.version !== input.productVersion) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Product or offer changed; reload before publication.");
    if (offer.store.status !== "ACTIVE" || offer.product.scope !== "STORE_PRIVATE" || offer.product.sourceStoreId !== offer.storeId
      || !["APPROVED", "ACTIVE"].includes(offer.product.status) || offer.product.moderationStatus !== "APPROVED" || !offer.product.approvedByUserId
      || offer.status !== "SUBMITTED" || !offer.approvedByUserId || offer.variant.status !== "DRAFT"
      || offer.product.productTypeDefinition.status !== "ACTIVE" || offer.product.primaryCategory.status !== "ACTIVE") throw new CatalogPolicyError("CATALOG_PUBLICATION_NOT_REVIEWED", "An active store, approved product type/category and separately approved product and offer are required.");
    if (!price || price.status !== "DRAFT" || price.effectiveFrom > new Date() || (price.effectiveUntil && price.effectiveUntil <= new Date())) throw new CatalogPolicyError("CATALOG_PUBLICATION_PRICE_INVALID", "Choose the exact reviewed draft price within its effective window.");
    if ([offer.store.ownerUserId, offer.product.createdByUserId, offer.product.submittedByUserId, offer.createdByUserId, offer.submittedByUserId, price.createdByUserId].includes(actorUserId)) throw new CatalogPolicyError("CATALOG_PUBLICATION_SELF_REVIEW", "A separate administrator must publish this vendor listing.", 403);
    if (offer.product.media.filter(media => media.role === "PRIMARY" && media.variantId === null).length !== 1
      || offer.product.media.some(media => media.asset.status !== "READY" || !media.asset.privacyInspectionPassed || !media.asset.storageConfirmedAt || !media.asset.validatedAt)) throw new CatalogPolicyError("CATALOG_PUBLICATION_MEDIA_INVALID", "Every attached image must have confirmed, privacy-inspected READY storage.");
    await tx.storeOfferPriceVersion.updateMany({ where: { offerId, status: "ACTIVE" }, data: { status: "RETIRED", retiredAt: new Date() } });
    await tx.storeOfferPriceVersion.update({ where: { id: price.id }, data: { status: "ACTIVE", activatedByUserId: actorUserId, activatedAt: new Date() } });
    await tx.catalogProduct.update({ where: { id: offer.productId }, data: { status: "ACTIVE", publicationStatus: "PUBLISHED", version: { increment: 1 } } });
    await tx.catalogProductVariant.update({ where: { id: offer.variantId }, data: { status: "ACTIVE", version: { increment: 1 } } });
    const published = await tx.storeCatalogOffer.update({ where: { id: offer.id }, data: { status: "ACTIVE", publicationStatus: "PUBLISHED", currentPriceVersionId: price.id, version: { increment: 1 } }, select: { status: true, publicationStatus: true, version: true } });
    const snapshot = await rebuildCatalogPublicationSnapshot(offerId, actorUserId, true, tx);
    await new StorefrontProjectionService(tx).buildPublishedSnapshot(snapshot.publicReference);
    await rebuildStorefrontStoreDocument(offer.storeId, tx);
    await rebuildStorefrontCategoryDocument(offer.product.primaryCategoryId, tx);
    await recordCatalogEvidence(tx, { aggregateType: "PRICE", aggregateReference: price.publicReference, aggregateVersion: price.versionNumber, action: "ACTIVATED", eventType: "PRICE_ACTIVATED", actorUserId, reasonCode: input.reasonCode });
    // The receipt binds the complete atomic publication, not a browser success state.
    await recordCatalogEvidence(tx, { aggregateType: "OFFER", aggregateReference: offer.publicReference, aggregateVersion: published.version, action: "LISTING_PUBLISHED", eventType: "OFFER_PUBLISHED", actorUserId, reasonCode: input.reasonCode, safeMetadata: { snapshotReference: snapshot.publicReference } });
    await tx.catalogOperationReceipt.create({ data: { actorUserId, storeId: offer.storeId, action: "OFFER:LISTING_PUBLISHED", operationId: input.operationId, requestHash: hash, aggregateReference: snapshot.publicReference } });
    return { snapshot: { publicReference: snapshot.publicReference, publicationVersion: snapshot.publicationVersion, status: snapshot.status }, offer: published, replayed: false };
  }, { timeout: 20_000 });
}
