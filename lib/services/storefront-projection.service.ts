import { prisma } from "@/lib/db/prisma";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { assertSnapshotContainsNoPrivateKeys, type CatalogPublicationSnapshotValue } from "@/lib/catalog/catalog-publication-snapshot";
import { deriveStorefrontAvailability } from "@/lib/storefront/storefront-availability-policy";
import { STOREFRONT_CACHE_TAGS } from "@/lib/storefront/cache/storefront-cache-policy";
import { normalizeStorefrontQuery } from "@/lib/storefront/search/storefront-query-normalization";
import { STOREFRONT_SEARCH_INDEX_VERSION } from "@/lib/storefront/search/storefront-search-adapter";
import type { StorefrontDocument } from "@/lib/storefront/storefront-types";

type StorefrontProjectionClient = {
  storefrontProductDocument: { findUnique(args: unknown): Promise<{ projectionVersion: number; publicReference: string } | null>; upsert(args: unknown): Promise<{ id: string }>; updateMany(args: unknown): Promise<unknown> };
  storefrontProjectionHistory: { create(args: unknown): Promise<unknown> };
  storefrontProjectionCase: { upsert(args: unknown): Promise<unknown> };
  storefrontCacheInvalidation: { upsert(args: unknown): Promise<unknown> };
};
const storefrontClient = prisma as unknown as StorefrontProjectionClient;

export class StorefrontProjectionError extends Error {
  constructor(readonly reason: string, message: string, readonly aggregateReference: string) { super(message); this.name = "StorefrontProjectionError"; }
}

function publicScalarAttributes(value: unknown): Record<string, string | number | boolean | string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, item]): Array<[string, any]> => {
    if (!/^[a-z][a-z0-9_]{0,39}$/i.test(key)) return [];
    if (typeof item === "string") return [[key, item.normalize("NFKC").slice(0, 240)]];
    if (typeof item === "number" && Number.isFinite(item)) return [[key, item]];
    if (typeof item === "boolean") return [[key, item]];
    if (Array.isArray(item) && item.every((entry) => typeof entry === "string") && item.length <= 16) return [[key, item.map((entry) => entry.normalize("NFKC").slice(0, 120))]];
    return [];
  }));
}
function approvedFacetAttributes(schema: unknown, attributes: Record<string, string | number | boolean | string[]>): Record<string, string | number | boolean | string[]> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return {};
  const rawFacets = (schema as { facets?: unknown }).facets;
  if (!Array.isArray(rawFacets)) return {};
  const allowed = rawFacets.flatMap((facet) => facet && typeof facet === "object" && typeof (facet as { code?: unknown }).code === "string" && (facet as { public?: unknown }).public !== false ? [(facet as { code: string }).code] : []);
  return Object.fromEntries(allowed.filter((code) => Object.hasOwn(attributes, code)).map((code) => [code, attributes[code]!]).slice(0, 16));
}
function cleanDescription(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  return value.normalize("NFKC").replace(/<[^>]*>/g, "").trim().slice(0, 8_000) || undefined;
}

async function recordCase(args: { aggregateReference: string; reason: string; summary: string }) {
  const reason = args.reason as "SNAPSHOT_MISSING";
  await storefrontClient.storefrontProjectionCase.upsert({
    where: { aggregateType_aggregateReference_reason: { aggregateType: "SNAPSHOT", aggregateReference: args.aggregateReference, reason } },
    update: { status: "OBSERVED", observationCount: { increment: 1 }, version: { increment: 1 }, safeSummary: args.summary.slice(0, 500), lastObservedAt: new Date(), resolvedAt: null, resolutionCode: null },
    create: { publicReference: catalogPublicReference("SPC"), aggregateType: "SNAPSHOT", aggregateReference: args.aggregateReference, reason, safeSummary: args.summary.slice(0, 500) },
  });
}

export class StorefrontProjectionService {
  async buildPublishedSnapshot(snapshotReference: string): Promise<StorefrontDocument> {
    const source = await prisma.catalogPublicationSnapshot.findUnique({
      where: { publicReference: snapshotReference },
      include: {
        product: { include: { primaryCategory: true, productTypeDefinition: true, brand: true, media: { include: { asset: true }, orderBy: { displayOrder: "asc" } } } },
        variant: { include: { optionValues: { include: { optionValue: { include: { option: true } } } } } },
        offer: { include: { store: true, priceVersions: { where: { status: "ACTIVE" }, orderBy: { versionNumber: "desc" } }, inventoryItem: { include: { levels: true } } } },
      },
    });
    if (!source) { await recordCase({ aggregateReference: snapshotReference, reason: "SNAPSHOT_MISSING", summary: "No publication snapshot exists for the requested projection." }); throw new StorefrontProjectionError("SNAPSHOT_MISSING", "Published catalog evidence is unavailable.", snapshotReference); }
    if (source.status !== "PUBLISHED" || source.supersededAt) { await recordCase({ aggregateReference: source.publicReference, reason: "SNAPSHOT_NOT_PUBLISHED", summary: "Snapshot is not currently published or has been superseded." }); throw new StorefrontProjectionError("SNAPSHOT_NOT_PUBLISHED", "Published catalog evidence is unavailable.", source.publicReference); }
    try { assertSnapshotContainsNoPrivateKeys(source.snapshot); } catch { await recordCase({ aggregateReference: source.publicReference, reason: "APPLICATION_FAILURE", summary: "Snapshot failed the private-field safety check." }); throw new StorefrontProjectionError("APPLICATION_FAILURE", "Published catalog evidence is invalid.", source.publicReference); }
    const snapshot = source.snapshot as unknown as CatalogPublicationSnapshotValue;
    if (snapshot.publicationVersion !== source.publicationVersion || snapshot.productReference !== source.product.publicReference || snapshot.variantReference !== source.variant.publicReference || snapshot.offerReference !== source.offer.publicReference) {
      await recordCase({ aggregateReference: source.publicReference, reason: "SNAPSHOT_VERSION_MISMATCH", summary: "Snapshot references do not match canonical source evidence." });
      throw new StorefrontProjectionError("SNAPSHOT_VERSION_MISMATCH", "Published catalog evidence is inconsistent.", source.publicReference);
    }
    const productEligible = source.product.status === "ACTIVE" && source.product.publicationStatus === "PUBLISHED" && source.variant.status === "ACTIVE" && source.product.primaryCategory.status === "ACTIVE" && source.product.productTypeDefinition.status === "ACTIVE" && source.product.productTypeDefinition.versionNumber === source.product.productTypeVersionNumber;
    if (!productEligible) { await recordCase({ aggregateReference: source.publicReference, reason: "CATEGORY_NOT_ELIGIBLE", summary: "Product, category, variant, or product-type publication evidence is not eligible." }); throw new StorefrontProjectionError("CATEGORY_NOT_ELIGIBLE", "Published catalog evidence is unavailable.", source.publicReference); }
    if (source.offer.status !== "ACTIVE" || source.offer.publicationStatus !== "PUBLISHED" || source.offer.store.status !== "ACTIVE") { await recordCase({ aggregateReference: source.publicReference, reason: "OFFER_NOT_ELIGIBLE", summary: "Offer or store does not meet public eligibility." }); throw new StorefrontProjectionError("OFFER_NOT_ELIGIBLE", "Published catalog evidence is unavailable.", source.publicReference); }
    const now = new Date();
    const price = source.offer.priceVersions.find((item) => item.effectiveFrom <= now && (!item.effectiveUntil || item.effectiveUntil > now) && item.currency === "ZAR" && item.priceIncludesTax);
    if (!price || snapshot.price.versionReference !== price.publicReference || snapshot.price.amount !== price.amount.toFixed(2)) { await recordCase({ aggregateReference: source.publicReference, reason: "PRICE_VERSION_MISMATCH", summary: "Snapshot price does not match an active exact ZAR price version." }); throw new StorefrontProjectionError("PRICE_VERSION_MISMATCH", "Published catalog evidence is unavailable.", source.publicReference); }
    const primary = source.product.media.find((item) => item.role === "PRIMARY" && item.variantId === null && item.asset.status === "READY" && item.asset.privacyInspectionPassed && snapshot.media.some((media) => media.assetReference === item.asset.publicReference));
    if (!primary || !primary.asset.width || !primary.asset.height) { await recordCase({ aggregateReference: source.publicReference, reason: "MEDIA_NOT_READY", summary: "Snapshot has no READY, privacy-inspected primary media evidence." }); throw new StorefrontProjectionError("MEDIA_NOT_READY", "Published catalog evidence is unavailable.", source.publicReference); }
    const attributes = publicScalarAttributes(source.product.attributeValues);
    const variantAttributes = publicScalarAttributes(source.variant.attributeValues);
    const filterableAttributes = approvedFacetAttributes(source.product.productTypeDefinition.searchFacetSchema, { ...attributes, ...variantAttributes });
    const variantOptions = Object.fromEntries(source.variant.optionValues.map((link) => [link.optionValue.option.code, link.optionValue.label]));
    const inventory = source.offer.inventoryItem;
    const sourceFresh = !inventory?.levels.some((level) => now.getTime() - level.updatedAt.getTime() > 30 * 60 * 1000);
    const availability = deriveStorefrontAvailability({ trackingMode: source.offer.inventoryTrackingMode, availableQuantities: inventory?.levels.map((level) => level.available), allowBackorder: inventory?.allowBackorder, sourceFresh, eligible: true });
    const searchText = normalizeStorefrontQuery([source.product.title, source.product.brand?.name, source.product.productTypeDefinition.name, source.product.primaryCategory.path, source.offer.store.name, source.variant.gtin, source.variant.mpn, ...Object.values(variantOptions), ...Object.values(filterableAttributes).flatMap((value) => Array.isArray(value) ? value : [String(value)])].filter(Boolean).join(" ")).value;
    const document: StorefrontDocument = {
      publicReference: catalogPublicReference("SFD"), publicationVersion: source.publicationVersion, productReference: source.product.publicReference, productSlug: source.product.slug, productScope: source.product.scope, variantReference: source.variant.publicReference, offerReference: source.offer.publicReference, storeReference: source.offer.store.slug, storeSlug: source.offer.store.slug, categoryReference: source.product.primaryCategory.publicReference, categoryPath: source.product.primaryCategory.path, productTypeCode: source.product.productTypeDefinition.code, productTypeVersion: source.product.productTypeVersionNumber, ...(source.product.brand ? { brandReference: source.product.brand.publicReference, brandName: source.product.brand.name } : {}), title: source.product.title, normalizedTitle: source.product.normalizedTitle, ...(cleanDescription(source.product.shortDescription) ? { shortDescription: cleanDescription(source.product.shortDescription) } : {}), ...(cleanDescription(source.product.description) ? { description: cleanDescription(source.product.description) } : {}), searchText, searchableAttributes: { ...attributes, ...variantAttributes }, filterableAttributes, variantOptions, condition: source.product.condition, fulfilmentMode: source.offer.fulfilmentMode, sellingUnit: source.offer.sellingUnit, price: { publicReference: price.publicReference, amount: price.amount.toFixed(2), currency: "ZAR", includesTax: true, ...(price.unitPriceAmount ? { unitAmount: price.unitPriceAmount.toFixed(2) } : {}), ...(price.unitPriceUnit ? { unit: price.unitPriceUnit } : {}), ...(price.unitPriceQuantity ? { quantity: price.unitPriceQuantity.toFixed(4) } : {}) }, availability, primaryMedia: { publicReference: primary.asset.publicReference, width: primary.asset.width, height: primary.asset.height, alt: primary.altText }, publishedAt: source.createdAt.toISOString(), sourceUpdatedAt: source.product.updatedAt.toISOString(), searchable: true, indexable: false,
    };
    await this.persist(source.id, document, source.product.id, source.variant.id, source.offer.id, source.offer.store.id, source.product.primaryCategory.id, price.id);
    return document;
  }

  private async persist(snapshotId: string, document: StorefrontDocument, productId: string, variantId: string, offerId: string, storeId: string, categoryId: string, priceVersionId: string) {
    const existing = await storefrontClient.storefrontProductDocument.findUnique({ where: { publicationSnapshotId: snapshotId }, select: { projectionVersion: true, publicReference: true } });
    if (existing) document.publicReference = existing.publicReference;
    const projectionVersion = (existing?.projectionVersion ?? 0) + 1;
    const commonData = {
      publicationSnapshotId: snapshotId, publicationVersion: document.publicationVersion, productId, productPublicReference: document.productReference, productSlug: document.productSlug, productScope: document.productScope, variantId, variantPublicReference: document.variantReference, offerId, offerPublicReference: document.offerReference, storeId, storePublicReference: document.storeReference, storeSlug: document.storeSlug, categoryId, categoryPublicReference: document.categoryReference, categoryPath: document.categoryPath, productTypeCode: document.productTypeCode, productTypeVersion: document.productTypeVersion, brandPublicReference: document.brandReference ?? null, brandName: document.brandName ?? null, title: document.title, normalizedTitle: document.normalizedTitle, shortDescription: document.shortDescription ?? null, publicDescription: document.description ?? null, searchText: document.searchText, searchableAttributes: document.searchableAttributes, filterableAttributes: document.filterableAttributes, variantOptions: document.variantOptions, condition: document.condition, fulfilmentMode: document.fulfilmentMode, sellingUnit: document.sellingUnit, priceVersionId, pricePublicReference: document.price.publicReference, priceAmount: document.price.amount, currency: "ZAR", priceIncludesTax: true, unitPriceAmount: document.price.unitAmount ?? null, unitPriceUnit: document.price.unit ?? null, unitPriceQuantity: document.price.quantity ?? null, inventoryTrackingMode: document.availability === "MADE_TO_ORDER" ? "MADE_TO_ORDER" : document.availability === "UNTRACKED" ? "UNTRACKED" : "TRACKED", availabilityState: document.availability, primaryMediaPublicReference: document.primaryMedia?.publicReference ?? null, primaryMediaWidth: document.primaryMedia?.width ?? null, primaryMediaHeight: document.primaryMedia?.height ?? null, primaryMediaAlt: document.primaryMedia?.alt ?? null, searchable: true, indexable: false, status: "ACTIVE", publishedAt: new Date(document.publishedAt), sourceUpdatedAt: new Date(document.sourceUpdatedAt), indexedAt: new Date(), projectionVersion,
    };
    const saved = await storefrontClient.storefrontProductDocument.upsert({ where: { publicationSnapshotId: snapshotId }, create: { ...commonData, publicReference: document.publicReference }, update: commonData });
    await storefrontClient.storefrontProductDocument.updateMany({ where: { offerId, publicationSnapshotId: { not: snapshotId }, status: "ACTIVE" }, data: { status: "WITHDRAWN", searchable: false, indexable: false } });
    await storefrontClient.storefrontProjectionHistory.create({ data: { documentId: saved.id, sourceVersion: document.publicationVersion, projectionVersion, action: existing ? "REPLAYED" : "BUILT", safeSummary: "Projection was derived from published snapshot evidence." } });
    for (const tag of [STOREFRONT_CACHE_TAGS.product(document.productReference), STOREFRONT_CACHE_TAGS.variant(document.variantReference), STOREFRONT_CACHE_TAGS.store(document.storeReference), STOREFRONT_CACHE_TAGS.category(document.categoryReference), STOREFRONT_CACHE_TAGS.searchIndex(STOREFRONT_SEARCH_INDEX_VERSION)]) {
      await storefrontClient.storefrontCacheInvalidation.upsert({ where: { tag_sourceReference_sourceVersion: { tag, sourceReference: document.offerReference, sourceVersion: document.publicationVersion } }, create: { publicReference: catalogPublicReference("SCI"), tag, sourceReference: document.offerReference, sourceVersion: document.publicationVersion, safeSummary: "Projection refresh requires public cache invalidation." }, update: { status: "PENDING", safeSummary: "Projection refresh requires public cache invalidation." } });
    }
  }

  async withdrawOffer(offerReference: string): Promise<void> {
    await storefrontClient.storefrontProductDocument.updateMany({ where: { offerPublicReference: offerReference, status: "ACTIVE" }, data: { status: "WITHDRAWN", searchable: false, indexable: false } });
  }
}
