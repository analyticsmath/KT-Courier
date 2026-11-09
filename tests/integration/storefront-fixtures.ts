import { createHash, randomUUID } from "node:crypto";
import { pickupCertificationFingerprint } from "@/lib/admin/store-checkout-certification.service";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildCatalogPublicationSnapshot } from "@/lib/catalog/catalog-publication-snapshot";
import { StorefrontProjectionService } from "@/lib/services/storefront-projection.service";
import { createGate4Store, createGate4ActiveProductScenario } from "./gate4/fixtures";
import { validateGate4DatabaseSafety } from "./gate4/harness-safety";

export async function createStorefrontFixture(options?: { privateSnapshot: boolean }) {
  const safety = validateGate4DatabaseSafety();
  if (!safety.ok) throw new Error(safety.reason);
  const { store } = await createGate4Store("storefront", "projection");
  const source = await createGate4ActiveProductScenario("storefront", "projection", store.id, { available: 10 });
  // Public marketplace search must have the same approved store evidence
  // as checkout. This fixture only runs behind validateGate4DatabaseSafety.
  const pickup = await prisma.address.create({ data: {
    storeId: store.id, type: "PICKUP", isDefault: true,
    line1: "10 Disposable Test Lane", line2: "Central", city: "Johannesburg",
    province: "Gauteng", postalCode: "2001", country: "South Africa",
    latitude: new Prisma.Decimal("-26.2041000"), longitude: new Prisma.Decimal("28.0473000"),
    placeId: `fixture-${randomUUID()}`,
  } });
  await prisma.store.update({ where: { id: store.id }, data: { defaultPickupAddressId: pickup.id } });
  const certRef = `disposable-storefront-${randomUUID()}`;
  await prisma.storeCheckoutCertification.create({ data: {
    storeId: store.id, pickupAddressId: pickup.id,
    pickupFingerprint: pickupCertificationFingerprint(pickup),
    coverageRegionId: "disposable-jhb", serviceSignature: createHash("sha256").update(certRef).digest("hex"),
    routeEvidenceReference: `${certRef}:synthetic-route`,
    routeEvidenceDigest: createHash("sha256").update(`${certRef}:synthetic-route`).digest("hex"),
    checkoutEvidenceReference: `${certRef}:synthetic-checkout`,
    checkoutEvidenceDigest: createHash("sha256").update(`${certRef}:synthetic-checkout`).digest("hex"),
    preparedByUserId: store.ownerUserId!, approvedByUserId: source.adminUser.id,
    status: "APPROVED", approvedAt: new Date(), expiresAt: new Date(Date.now() + 3_600_000),
    reviewNote: "Disposable integration fixture only; no customer payment or production approval.",
  } });
  // Public product visibility also requires a source-bound ACTIVE store
  // document, not just an approved merchant certificate. Preserve both gates.
  await prisma.storefrontStoreDocument.create({ data: {
    storeId: store.id, storePublicReference: `SFS-DISPOSABLE-${randomUUID()}`,
    slug: store.slug, name: store.name, shortDescription: "Isolated published merchant",
    publicCategoryCodes: [source.category.path], fulfilmentModes: ["COURIER_DELIVERY"],
    serviceAreaReferences: ["disposable-jhb"], publicStatus: "ACTIVE", publishedOfferCount: 1,
    sourceUpdatedAt: new Date(), indexedAt: new Date(),
  } });
  source.product = await prisma.catalogProduct.update({ where: { id: source.product.id }, data: { publicReference: `CP-${randomUUID().replaceAll("-", "").toUpperCase()}` } });
  const ref = `media_${randomUUID().replaceAll("-", "")}`;
  const asset = await prisma.catalogMediaAsset.create({ data: {
    publicReference: ref, ownerType: "STORE", ownerStoreId: store.id, purpose: "PRODUCT_IMAGE",
    storageProvider: "disposable", storageKey: `catalog-media/${randomUUID().replaceAll("-", "").repeat(2)}`, declaredMimeType: "image/png", declaredByteSize: 1024,
    mimeType: "image/png", byteSize: 1024, checksum: "a".repeat(64), storageConfirmedAt: new Date(), validatedAt: new Date(),
    width: 400, height: 300, privacyInspectionPassed: true, status: "READY",
    createdByUserId: source.adminUser.id, updatedByUserId: source.adminUser.id,
  } });
  await prisma.catalogProductMedia.create({ data: { productId: source.product.id, assetId: asset.id, role: "PRIMARY", altText: "Disposable product image" } });
  const value = buildCatalogPublicationSnapshot({
    productReference: source.product.publicReference, variantReference: source.variant.publicReference,
    offerReference: source.offer.publicReference, storeReference: store.slug,
    productTypeCode: "DISPOSABLE", productTypeVersion: 1, categoryPath: source.category.path,
    title: source.product.title, description: "Disposable fixture", identifiers: {}, attributes: options?.privateSnapshot ? { email: "private@disposable.test" } : {}, variantOptions: {},
    price: { versionReference: source.priceVersion.publicReference, amount: source.priceVersion.amount.toFixed(2), currency: "ZAR", includesTax: true },
    availability: {}, media: [{ assetReference: asset.publicReference, role: "PRIMARY", altText: "Disposable product image", order: 0 }], compliance: {},
  });
  const snapshot = await prisma.catalogPublicationSnapshot.create({ data: {
    publicReference: `snapshot_${randomUUID().replaceAll("-", "")}`, productId: source.product.id, variantId: source.variant.id,
    offerId: source.offer.id, versionNumber: 1, publicationVersion: value.publicationVersion,
    snapshot: value as Prisma.InputJsonValue, status: "PUBLISHED", createdByUserId: source.adminUser.id,
  } });
  return { source, store, asset, snapshot, projections: new StorefrontProjectionService() };
}
