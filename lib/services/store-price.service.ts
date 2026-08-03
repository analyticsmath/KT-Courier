import { prisma } from "@/lib/db/prisma";
import { assertExactZarPrice, assertPricePeriod } from "@/lib/catalog/catalog-price-policy";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { assertCatalogProductionActivationAllowed } from "@/lib/catalog/catalog-production-lock";
import { CatalogConflictError, CatalogNotFoundError, CatalogOwnershipError } from "@/lib/catalog/errors";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";

export async function createStoreOfferPriceVersion(storeId: string, actorUserId: string, input: {
  offerPublicReference: string;
  amount: string;
  currency: "ZAR";
  priceIncludesTax: true;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  reasonCode?: string;
  offerVersion: number;
  operationId: string;
}) {
  assertExactZarPrice(input);
  const offer = await prisma.storeCatalogOffer.findUnique({ where: { publicReference: input.offerPublicReference }, include: { priceVersions: true } });
  if (!offer) throw new CatalogNotFoundError("Store catalog offer was not found.");
  if (offer.storeId !== storeId) throw new CatalogOwnershipError();
  const effectiveFrom = new Date(input.effectiveFrom);
  const effectiveUntil = input.effectiveUntil ? new Date(input.effectiveUntil) : null;
  assertPricePeriod({ effectiveFrom, effectiveUntil }, offer.priceVersions.filter((price) => ["SCHEDULED", "ACTIVE"].includes(price.status)));
  const nextNumber = Math.max(0, ...offer.priceVersions.map((price) => price.versionNumber)) + 1;
  const publicReference = catalogPublicReference("CPR");
  return prisma.$transaction(async (tx) => {
    const current = await tx.storeCatalogOffer.updateMany({ where: { id: offer.id, storeId, version: input.offerVersion }, data: { version: { increment: 1 } } });
    if (current.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Offer changed; reload before adding a price.");
    const price = await tx.storeOfferPriceVersion.create({ data: { publicReference, offerId: offer.id, versionNumber: nextNumber, amount: input.amount, currency: "ZAR", priceIncludesTax: true, effectiveFrom, effectiveUntil, status: "DRAFT", reasonCode: input.reasonCode, createdByUserId: actorUserId } });
    await recordCatalogEvidence(tx, { aggregateType: "PRICE", aggregateReference: publicReference, aggregateVersion: nextNumber, action: "DRAFT_CREATED", eventType: "OFFER_UPDATED", actorUserId, safeMetadata: { offerReference: offer.publicReference, currency: "ZAR", includesTax: true }, operation: { operationId: input.operationId, storeId, request: input } });
    return price;
  });
}

export async function activateStoreOfferPriceVersion(priceId: string, actorUserId: string, testApproval?: { approved: true }) {
  assertCatalogProductionActivationAllowed("PRICE", testApproval);
  const price = await prisma.storeOfferPriceVersion.findUnique({ where: { id: priceId } });
  if (!price) throw new CatalogNotFoundError("Store offer price was not found.");
  return prisma.$transaction(async (tx) => {
    await tx.storeOfferPriceVersion.updateMany({ where: { offerId: price.offerId, status: "ACTIVE" }, data: { status: "RETIRED", retiredAt: new Date() } });
    const activated = await tx.storeOfferPriceVersion.update({ where: { id: price.id }, data: { status: "ACTIVE", activatedByUserId: actorUserId, activatedAt: new Date() } });
    await tx.storeCatalogOffer.update({ where: { id: price.offerId }, data: { currentPriceVersionId: price.id, version: { increment: 1 } } });
    await recordCatalogEvidence(tx, { aggregateType: "PRICE", aggregateReference: price.publicReference, aggregateVersion: price.versionNumber, action: "ACTIVATED", eventType: "PRICE_ACTIVATED", actorUserId });
    return activated;
  });
}
