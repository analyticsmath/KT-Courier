import { prisma } from "@/lib/db/prisma";
import { buildCatalogPublicationSnapshot, assertSnapshotContainsNoPrivateKeys } from "@/lib/catalog/catalog-publication-snapshot";
import { assertCatalogProductionActivationAllowed } from "@/lib/catalog/catalog-production-lock";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { CatalogNotFoundError, CatalogPolicyError } from "@/lib/catalog/errors";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";
import { toInputJsonObject } from "@/lib/json/input-json";

export async function rebuildCatalogPublicationSnapshot(offerId: string, actorUserId: string, publish = false) {
  if (publish) assertCatalogProductionActivationAllowed("PUBLICATION");
  const offer = await prisma.storeCatalogOffer.findUnique({ where: { id: offerId }, include: { store: true, product: { include: { productTypeDefinition: true, primaryCategory: true, brand: true, media: { include: { asset: true } } } }, variant: { include: { optionValues: { include: { optionValue: { include: { option: true } } } } } }, priceVersions: { where: { status: { in: ["ACTIVE", "SCHEDULED", "DRAFT"] } }, orderBy: { versionNumber: "desc" }, take: 1 }, inventoryItem: { include: { levels: { include: { location: true } } } } } });
  if (!offer) throw new CatalogNotFoundError("Catalog offer was not found.");
  const price = offer.priceVersions[0];
  if (!price) throw new CatalogPolicyError("SNAPSHOT_PRICE_REQUIRED", "Publication snapshot requires price evidence.");
  const publishableMedia = offer.product.media.filter((media) => media.role !== "COMPLIANCE_DOCUMENT");
  if (publishableMedia.some((media) => media.asset.status !== "READY")) throw new CatalogPolicyError("SNAPSHOT_MEDIA_NOT_READY", "Publication snapshot requires READY media evidence.");
  if (publishableMedia.filter((media) => media.role === "PRIMARY" && media.variantId === null).length !== 1) throw new CatalogPolicyError("SNAPSHOT_PRIMARY_MEDIA_REQUIRED", "Publication snapshot requires exactly one READY primary product image.");
  const snapshot = buildCatalogPublicationSnapshot({
    productReference: offer.product.publicReference,
    variantReference: offer.variant.publicReference,
    offerReference: offer.publicReference,
    storeReference: offer.store.slug,
    productTypeCode: offer.product.productTypeDefinition.code,
    productTypeVersion: offer.product.productTypeVersionNumber,
    categoryPath: offer.product.primaryCategory.path,
    title: offer.product.title,
    description: offer.product.description ?? "",
    brand: offer.product.brand?.name,
    identifiers: Object.fromEntries(Object.entries({ gtin: offer.variant.gtin, mpn: offer.variant.mpn, storeSku: offer.storeSku }).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
    attributes: offer.product.attributeValues as Record<string, unknown>,
    variantOptions: Object.fromEntries(offer.variant.optionValues.map((link) => [link.optionValue.option.code, link.optionValue.label])),
    price: { versionReference: price.publicReference, amount: price.amount.toFixed(2), currency: "ZAR", includesTax: true },
    availability: { trackingMode: offer.inventoryTrackingMode, locations: offer.inventoryItem?.levels.map((level) => ({ location: level.location.publicReference, available: level.available })) ?? [] },
    media: publishableMedia.map((media) => ({ assetReference: media.asset.publicReference, role: media.role, altText: media.altText, order: media.displayOrder })),
    compliance: offer.product.complianceValues as Record<string, unknown>,
  });
  assertSnapshotContainsNoPrivateKeys(snapshot);
  const latest = await prisma.catalogPublicationSnapshot.findFirst({ where: { offerId }, orderBy: { versionNumber: "desc" } });
  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  return prisma.$transaction(async (tx) => {
    const record = await tx.catalogPublicationSnapshot.create({ data: { publicReference: catalogPublicReference("CPS"), productId: offer.productId, variantId: offer.variantId, offerId, versionNumber, publicationVersion: snapshot.publicationVersion, snapshot: toInputJsonObject(snapshot), status: publish ? "PUBLISHED" : "BLOCKED", createdByUserId: actorUserId } });
    await recordCatalogEvidence(tx, { aggregateType: "SNAPSHOT", aggregateReference: record.publicReference, aggregateVersion: versionNumber, action: publish ? "PUBLISHED" : "PREVIEW_REBUILT", eventType: "SNAPSHOT_REBUILT", actorUserId, safeMetadata: { offerReference: offer.publicReference, status: record.status } });
    return record;
  });
}
