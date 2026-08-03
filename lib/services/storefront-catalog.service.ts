import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { loadStorefrontDocuments, PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import type { StorefrontDocument } from "@/lib/storefront/storefront-types";
import { publicStoreScheduleStatus } from "@/lib/storefront/storefront-editorial-policy";

type CategoryRow = { categoryPublicReference: string; canonicalPath: string; name: string; description: string | null; publicImageReference: string | null; parentPublicReference: string | null; childNavigation: unknown; productCount: number; seoTitle: string | null; seoDescription: string | null; sourceUpdatedAt: Date };
type StoreRow = { storePublicReference: string; slug: string; name: string; shortDescription: string | null; logoMediaReference: string | null; heroMediaReference: string | null; publicCategoryCodes: unknown; fulfilmentModes: unknown; serviceAreaReferences: unknown; publishedOfferCount: number; sourceUpdatedAt: Date };
function publicArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 40) : []; }
function publicChildren(value: unknown): Array<{ reference: string; path: string; name: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => item && typeof item === "object" && typeof (item as { reference?: unknown }).reference === "string" && typeof (item as { path?: unknown }).path === "string" && typeof (item as { name?: unknown }).name === "string" ? [{ reference: (item as { reference: string }).reference, path: (item as { path: string }).path, name: (item as { name: string }).name }] : []).slice(0, 40);
}

export async function listStorefrontCategories() {
  const rows = await prisma.$queryRaw<CategoryRow[]>`SELECT "categoryPublicReference", "canonicalPath", "name", "description", "publicImageReference", "parentPublicReference", "childNavigation", "productCount", "seoTitle", "seoDescription", "sourceUpdatedAt" FROM "StorefrontCategoryDocument" ORDER BY "canonicalPath" ASC LIMIT 200`;
  return rows.map((row) => ({ reference: row.categoryPublicReference, path: row.canonicalPath, name: row.name, ...(row.description ? { description: row.description } : {}), ...(row.publicImageReference ? { imageReference: row.publicImageReference } : {}), ...(row.parentPublicReference ? { parentReference: row.parentPublicReference } : {}), children: publicChildren(row.childNavigation), productCount: row.productCount, ...(row.seoTitle ? { seoTitle: row.seoTitle } : {}), ...(row.seoDescription ? { seoDescription: row.seoDescription } : {}), updatedAt: row.sourceUpdatedAt.toISOString() }));
}

export async function getStorefrontCategory(path: string) {
  const normPath = path.startsWith("/") ? path : `/${path}`;
  const rows = await prisma.$queryRaw<CategoryRow[]>(Prisma.sql`SELECT "categoryPublicReference", "canonicalPath", "name", "description", "publicImageReference", "parentPublicReference", "childNavigation", "productCount", "seoTitle", "seoDescription", "sourceUpdatedAt" FROM "StorefrontCategoryDocument" WHERE ("canonicalPath" = ${path} OR "canonicalPath" = ${normPath}) LIMIT 1`);
  const row = rows[0];
  if (!row) return null;
  const products = await loadStorefrontDocuments({ categoryPath: row.canonicalPath, limit: 200 });
  return { reference: row.categoryPublicReference, path: row.canonicalPath, name: row.name, ...(row.description ? { description: row.description } : {}), ...(row.publicImageReference ? { imageReference: row.publicImageReference } : {}), children: publicChildren(row.childNavigation), productCount: row.productCount, products };
}

export async function listStorefrontStores(input: { query?: string; category?: string; fulfilment?: string; limit?: number }) {
  const rows = await prisma.$queryRaw<StoreRow[]>(Prisma.sql`SELECT "storePublicReference", "slug", "name", "shortDescription", "logoMediaReference", "heroMediaReference", "publicCategoryCodes", "fulfilmentModes", "serviceAreaReferences", "publishedOfferCount", "sourceUpdatedAt" FROM "StorefrontStoreDocument" WHERE "publicStatus" = 'ACTIVE' ORDER BY "name" ASC, "slug" ASC LIMIT ${Math.max(1, Math.min(input.limit ?? 48, 100))}`);
  const query = input.query?.toLocaleLowerCase("en-ZA").slice(0, 80);
  return rows.filter((row) => !query || row.name.toLocaleLowerCase("en-ZA").includes(query)).filter((row) => !input.category || publicArray(row.publicCategoryCodes).includes(input.category)).filter((row) => !input.fulfilment || publicArray(row.fulfilmentModes).includes(input.fulfilment)).map((row) => ({ reference: row.storePublicReference, slug: row.slug, name: row.name, ...(row.shortDescription ? { description: row.shortDescription } : {}), ...(row.logoMediaReference ? { logoMediaReference: row.logoMediaReference } : {}), ...(row.heroMediaReference ? { heroMediaReference: row.heroMediaReference } : {}), categories: publicArray(row.publicCategoryCodes), fulfilmentModes: publicArray(row.fulfilmentModes), serviceAreaReferences: publicArray(row.serviceAreaReferences), publishedOfferCount: row.publishedOfferCount, scheduleStatus: publicStoreScheduleStatus() }));
}

export async function getStorefrontStoreCategories(storeSlug: string) {
  const rows = await prisma.$queryRaw<Array<{ categoryPublicReference: string; categoryPath: string; productCount: bigint }>>(Prisma.sql`SELECT "categoryPublicReference", "categoryPath", COUNT(*) as "productCount" FROM "StorefrontProductDocument" WHERE "status" = 'ACTIVE' AND "searchable" = true AND "storeSlug" = ${storeSlug} GROUP BY "categoryPublicReference", "categoryPath" ORDER BY "categoryPath" ASC`);
  if (!rows.length) return [];
  const allCategories = await listStorefrontCategories();
  const catMap = new Map(allCategories.map((c) => [c.path, c]));
  return rows.flatMap((row) => {
    const normPath = row.categoryPath.startsWith("/") ? row.categoryPath : `/${row.categoryPath}`;
    const category = catMap.get(normPath) ?? catMap.get(row.categoryPath);
    if (!category) return [];
    return [{
      reference: category.reference,
      path: category.path,
      name: category.name,
      ...(category.description ? { description: category.description } : {}),
      ...(category.imageReference ? { imageReference: category.imageReference } : {}),
      productCount: Number(row.productCount),
    }];
  });
}

export async function getStorefrontStore(slug: string) {
  const rows = await prisma.$queryRaw<StoreRow[]>(Prisma.sql`SELECT "storePublicReference", "slug", "name", "shortDescription", "logoMediaReference", "heroMediaReference", "publicCategoryCodes", "fulfilmentModes", "serviceAreaReferences", "publishedOfferCount", "sourceUpdatedAt" FROM "StorefrontStoreDocument" WHERE "publicStatus" = 'ACTIVE' AND "slug" = ${slug} LIMIT 1`);
  const row = rows[0];
  if (!row) return null;
  const [products, storeCategories] = await Promise.all([
    loadStorefrontDocuments({ storeSlug: row.slug, limit: 10000 }),
    getStorefrontStoreCategories(row.slug),
  ]);
  return { reference: row.storePublicReference, slug: row.slug, name: row.name, ...(row.shortDescription ? { description: row.shortDescription } : {}), ...(row.logoMediaReference ? { logoMediaReference: row.logoMediaReference } : {}), ...(row.heroMediaReference ? { heroMediaReference: row.heroMediaReference } : {}), categories: storeCategories.map((c) => c.reference), storeCategories, fulfilmentModes: publicArray(row.fulfilmentModes), serviceAreaReferences: publicArray(row.serviceAreaReferences), publishedOfferCount: row.publishedOfferCount, scheduleStatus: publicStoreScheduleStatus(), products };
}

export async function getStorefrontProduct(productReference: string): Promise<{ product: StorefrontDocument; offers: StorefrontDocument[] } | null> {
  const offers = await loadStorefrontDocuments({ productReference, limit: 200 });
  if (!offers.length) return null;
  const product = [...offers].sort((left, right) => Number(left.price.amount) - Number(right.price.amount) || left.publicReference.localeCompare(right.publicReference))[0]!;
  return { product, offers };
}

export async function getStorefrontVariant(productReference: string, variantReference: string) {
  const offers = (await loadStorefrontDocuments({ productReference, variantReference, limit: 100 })).filter((document) => document.productReference === productReference);
  if (!offers.length) return null;
  return { variant: offers[0]!, offers };
}

export async function getStorefrontHome() {
  const [categories, stores, search] = await Promise.all([listStorefrontCategories(), listStorefrontStores({ limit: 12 }), new StorefrontSearchService(new PostgresStorefrontSearchAdapter()).search({ pageSize: 12 })]);
  return { categories: categories.slice(0, 12), stores, newArrivals: search.results, collections: [], availabilityNotice: "Choose a service area to see area-specific availability. Browsing is available without one." };
}

type CollectionRow = { publicReference: string; slug: string; name: string; description: string | null; collectionType: string; seoIndexable: boolean };
export async function getStorefrontCollection(slug: string) {
  const rows = await prisma.$queryRaw<CollectionRow[]>(Prisma.sql`SELECT "publicReference", "slug", "name", "description", "collectionType", "seoIndexable" FROM "StorefrontCollection" WHERE "slug" = ${slug} AND "status" = 'ACTIVE' AND ("effectiveFrom" IS NULL OR "effectiveFrom" <= CURRENT_TIMESTAMP) AND ("effectiveUntil" IS NULL OR "effectiveUntil" > CURRENT_TIMESTAMP) LIMIT 1`);
  const row = rows[0];
  if (!row) return null;
  const targets = await prisma.$queryRaw<Array<{ targetType: "CATEGORY" | "PRODUCT" | "VARIANT" | "STORE"; targetReference: string; displayOrder: number; safeLabelOverride: string | null }>>(Prisma.sql`SELECT "targetType", "targetReference", "displayOrder", "safeLabelOverride" FROM "StorefrontCollectionItem" WHERE "collectionId" = (SELECT "id" FROM "StorefrontCollection" WHERE "publicReference" = ${row.publicReference}) AND "removedAt" IS NULL ORDER BY "displayOrder" ASC, "id" ASC LIMIT 100`);
  const items = await Promise.all(targets.map(async (target) => {
    if (target.targetType === "PRODUCT") {
      const product = await getStorefrontProduct(target.targetReference);
      return product ? { targetType: target.targetType, targetReference: target.targetReference, label: target.safeLabelOverride, product: product.product } : null;
    }
    if (target.targetType === "VARIANT") {
      const offers = await loadStorefrontDocuments({ variantReference: target.targetReference, limit: 100 });
      return offers.length ? { targetType: target.targetType, targetReference: target.targetReference, label: target.safeLabelOverride, variant: offers[0], offers } : null;
    }
    if (target.targetType === "CATEGORY") {
      const categories = await prisma.$queryRaw<Array<{ canonicalPath: string; name: string; description: string | null; productCount: number }>>(Prisma.sql`SELECT "canonicalPath", "name", "description", "productCount" FROM "StorefrontCategoryDocument" WHERE "categoryPublicReference" = ${target.targetReference} AND "productCount" > 0 LIMIT 1`);
      const category = categories[0];
      return category ? { targetType: target.targetType, targetReference: target.targetReference, label: target.safeLabelOverride, category: { path: category.canonicalPath, name: category.name, ...(category.description ? { description: category.description } : {}), productCount: category.productCount } } : null;
    }
    if (target.targetType === "STORE") {
      const stores = await prisma.$queryRaw<Array<{ slug: string; name: string; shortDescription: string | null; publishedOfferCount: number }>>(Prisma.sql`SELECT "slug", "name", "shortDescription", "publishedOfferCount" FROM "StorefrontStoreDocument" WHERE "storePublicReference" = ${target.targetReference} AND "publicStatus" = 'ACTIVE' AND "publishedOfferCount" > 0 LIMIT 1`);
      const store = stores[0];
      return store ? { targetType: target.targetType, targetReference: target.targetReference, label: target.safeLabelOverride, store: { slug: store.slug, name: store.name, ...(store.shortDescription ? { description: store.shortDescription } : {}), publishedOfferCount: store.publishedOfferCount, scheduleStatus: "HOURS_UNAVAILABLE" as const } } : null;
    }
    // The enum and service accept only the four explicit types above. A stale
    // database value is omitted rather than becoming a public reference.
    return null;
  }));
  return { reference: row.publicReference, slug: row.slug, name: row.name, ...(row.description ? { description: row.description } : {}), type: row.collectionType, indexable: row.seoIndexable, items: items.filter(Boolean) };
}
