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

export type StorefrontModifierOptionDTO = {
  optionReference: string;
  name: string;
  priceDelta: string;
  currency: string;
};

export type StorefrontModifierGroupDTO = {
  groupReference: string;
  name: string;
  description?: string | null;
  minimumSelections: number;
  maximumSelections: number;
  isRequired: boolean;
  options: StorefrontModifierOptionDTO[];
};

export async function getStorefrontModifierGroupsForOffers(offerReferences: readonly string[]): Promise<Record<string, StorefrontModifierGroupDTO[]>> {
  if (!offerReferences.length) return {};
  const links = await prisma.storeOfferModifierGroup.findMany({
    where: {
      offer: { publicReference: { in: [...offerReferences] } },
      group: { status: "ACTIVE" },
    },
    include: {
      offer: { select: { publicReference: true } },
      group: {
        include: {
          options: {
            where: { status: "ACTIVE" },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          },
        },
      },
    },
    orderBy: { displayOrder: "asc" },
  });

  const byOffer: Record<string, StorefrontModifierGroupDTO[]> = {};
  for (const link of links) {
    const ref = link.offer.publicReference;
    if (!byOffer[ref]) byOffer[ref] = [];
    byOffer[ref].push({
      groupReference: link.group.publicReference,
      name: link.group.name,
      description: link.group.description,
      minimumSelections: link.group.minimumSelections,
      maximumSelections: link.group.maximumSelections,
      isRequired: link.group.isRequired,
      options: link.group.options.map((opt) => ({
        optionReference: opt.publicReference,
        name: opt.name,
        priceDelta: opt.priceDelta.toFixed(2),
        currency: opt.currency,
      })),
    });
  }
  return byOffer;
}

export async function getStorefrontProduct(productReference: string): Promise<{ product: StorefrontDocument; offers: StorefrontDocument[]; modifierGroupsByOffer: Record<string, StorefrontModifierGroupDTO[]> } | null> {
  const rawOffers = await loadStorefrontDocuments({ productReference, limit: 200 });
  if (!rawOffers.length) return null;
  const storeSlugs = [...new Set(rawOffers.map((offer) => offer.storeSlug))];
  const storeRows = storeSlugs.length
    ? await prisma.$queryRaw<Array<{ slug: string; name: string }>>(Prisma.sql`SELECT "slug", "name" FROM "StorefrontStoreDocument" WHERE "publicStatus" = 'ACTIVE' AND "slug" IN (${Prisma.join(storeSlugs)})`)
    : [];
  const storeNames = new Map(storeRows.map((store) => [store.slug, store.name]));
  const offers = rawOffers.map((offer) => ({ ...offer, ...(storeNames.get(offer.storeSlug) ? { storeName: storeNames.get(offer.storeSlug)! } : {}) }));
  const product = [...offers].sort((left, right) => Number(left.price.amount) - Number(right.price.amount) || left.publicReference.localeCompare(right.publicReference))[0]!;
  const modifierGroupsByOffer = await getStorefrontModifierGroupsForOffers(offers.map((o) => o.offerReference));
  return { product, offers, modifierGroupsByOffer };
}

export async function getStorefrontBrandName(brandReference: string) {
  const rows = await prisma.$queryRaw<Array<{ brandName: string | null }>>(Prisma.sql`SELECT "brandName" FROM "StorefrontProductDocument" WHERE "status" = 'ACTIVE' AND "brandPublicReference" = ${brandReference} AND "brandName" IS NOT NULL LIMIT 1`);
  return rows[0]?.brandName ?? null;
}

export async function getStorefrontFacetDisplayNames(input: Readonly<{ storeSlugs?: readonly string[]; brandReferences?: readonly string[] }>) {
  const storeSlugs = [...new Set(input.storeSlugs ?? [])].slice(0, 20);
  const brandReferences = [...new Set(input.brandReferences ?? [])].slice(0, 20);
  const [stores, brands] = await Promise.all([
    storeSlugs.length
      ? prisma.$queryRaw<Array<{ slug: string; name: string }>>(Prisma.sql`SELECT "slug", "name" FROM "StorefrontStoreDocument" WHERE "publicStatus" = 'ACTIVE' AND "slug" IN (${Prisma.join(storeSlugs)})`)
      : Promise.resolve([]),
    brandReferences.length
      ? prisma.$queryRaw<Array<{ brandPublicReference: string; brandName: string }>>(Prisma.sql`SELECT DISTINCT ON ("brandPublicReference") "brandPublicReference", "brandName" FROM "StorefrontProductDocument" WHERE "status" = 'ACTIVE' AND "brandPublicReference" IN (${Prisma.join(brandReferences)}) AND "brandName" IS NOT NULL ORDER BY "brandPublicReference", "publishedAt" DESC`)
      : Promise.resolve([]),
  ]);
  return {
    stores: new Map(stores.map((store) => [store.slug, store.name])),
    brands: new Map(brands.map((brand) => [brand.brandPublicReference, brand.brandName])),
  };
}

export async function getStorefrontSearchSuggestionLabels(input: Readonly<{
  categories: readonly { reference: string; path: string }[];
  stores: readonly { reference: string; slug: string }[];
}>) {
  const paths = [...new Set(input.categories.flatMap(({ path }) => [path, path.startsWith("/") ? path.slice(1) : `/${path}`]))].slice(0, 6);
  const slugs = [...new Set(input.stores.map((store) => store.slug))].slice(0, 3);
  const [categoryRows, storeRows] = await Promise.all([
    paths.length
      ? prisma.$queryRaw<Array<{ categoryPublicReference: string; canonicalPath: string; name: string; publicImageReference: string | null }>>(Prisma.sql`SELECT "categoryPublicReference", "canonicalPath", "name", "publicImageReference" FROM "StorefrontCategoryDocument" WHERE "canonicalPath" IN (${Prisma.join(paths)})`)
      : Promise.resolve([]),
    slugs.length
      ? prisma.$queryRaw<Array<{ storePublicReference: string; slug: string; name: string; logoMediaReference: string | null }>>(Prisma.sql`SELECT "storePublicReference", "slug", "name", "logoMediaReference" FROM "StorefrontStoreDocument" WHERE "publicStatus" = 'ACTIVE' AND "slug" IN (${Prisma.join(slugs)})`)
      : Promise.resolve([]),
  ]);
  const categories = new Map(categoryRows.map((category) => [category.canonicalPath, category]));
  const stores = new Map(storeRows.map((store) => [store.slug, store]));
  return {
    categories: input.categories.flatMap((suggestion) => {
      const category = categories.get(suggestion.path) ?? categories.get(suggestion.path.startsWith("/") ? suggestion.path.slice(1) : `/${suggestion.path}`);
      return category ? [{ reference: category.categoryPublicReference, path: category.canonicalPath, name: category.name, ...(category.publicImageReference ? { imageReference: category.publicImageReference } : {}) }] : [];
    }),
    stores: input.stores.flatMap((suggestion) => {
      const store = stores.get(suggestion.slug);
      return store ? [{ reference: store.storePublicReference, slug: store.slug, name: store.name, ...(store.logoMediaReference ? { logoMediaReference: store.logoMediaReference } : {}) }] : [];
    }),
  };
}

export async function getStorefrontVariant(productReference: string, variantReference: string) {
  const offers = (await loadStorefrontDocuments({ productReference, variantReference, limit: 100 })).filter((document) => document.productReference === productReference);
  if (!offers.length) return null;
  const modifierGroupsByOffer = await getStorefrontModifierGroupsForOffers(offers.map((o) => o.offerReference));
  return { variant: offers[0]!, offers, modifierGroupsByOffer };
}

export async function getStorefrontHome() {
  const [categories, stores, search, collections] = await Promise.all([listStorefrontCategories(), listStorefrontStores({ limit: 12 }), new StorefrontSearchService(new PostgresStorefrontSearchAdapter()).search({ pageSize: 12 }), listStorefrontCollections()]);
  const topLevelCategories = categories.filter((category) => {
    const normalizedPath = category.path.replace(/^\/+/, "");
    return normalizedPath.length > 0 && !normalizedPath.includes("/");
  });
  return { categories: topLevelCategories.slice(0, 12), stores, newArrivals: search.results, collections, availabilityNotice: "Choose a service area to see area-specific availability. Browsing is available without one." };
}

export async function listStorefrontCollections() {
  const rows = await prisma.$queryRaw<Array<CollectionRow & { itemCount: number; coverMediaReference: string | null }>>(Prisma.sql`
    SELECT collection."publicReference", collection."slug", collection."name", collection."description", collection."collectionType", collection."seoIndexable",
      COALESCE(targets."itemCount", 0)::int AS "itemCount", targets."coverMediaReference"
    FROM "StorefrontCollection" collection
    LEFT JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE product."productPublicReference" IS NOT NULL OR variant."variantPublicReference" IS NOT NULL OR category."categoryPublicReference" IS NOT NULL OR store."storePublicReference" IS NOT NULL) AS "itemCount",
        (ARRAY_AGG(COALESCE(product."primaryMediaPublicReference", variant."primaryMediaPublicReference", category."publicImageReference", store."heroMediaReference", store."logoMediaReference") ORDER BY item."displayOrder")
          FILTER (WHERE product."productPublicReference" IS NOT NULL OR variant."variantPublicReference" IS NOT NULL OR category."categoryPublicReference" IS NOT NULL OR store."storePublicReference" IS NOT NULL))[1] AS "coverMediaReference"
      FROM "StorefrontCollectionItem" item
      LEFT JOIN LATERAL (SELECT document."productPublicReference", document."primaryMediaPublicReference" FROM "StorefrontProductDocument" document WHERE item."targetType" = 'PRODUCT' AND document."productPublicReference" = item."targetReference" AND document."status" = 'ACTIVE' AND document."searchable" = true ORDER BY document."priceAmount" ASC LIMIT 1) product ON TRUE
      LEFT JOIN LATERAL (SELECT document."variantPublicReference", document."primaryMediaPublicReference" FROM "StorefrontProductDocument" document WHERE item."targetType" = 'VARIANT' AND document."variantPublicReference" = item."targetReference" AND document."status" = 'ACTIVE' AND document."searchable" = true ORDER BY document."priceAmount" ASC LIMIT 1) variant ON TRUE
      LEFT JOIN LATERAL (SELECT document."categoryPublicReference", document."publicImageReference" FROM "StorefrontCategoryDocument" document WHERE item."targetType" = 'CATEGORY' AND document."categoryPublicReference" = item."targetReference" AND document."productCount" > 0 LIMIT 1) category ON TRUE
      LEFT JOIN LATERAL (SELECT document."storePublicReference", document."heroMediaReference", document."logoMediaReference" FROM "StorefrontStoreDocument" document WHERE item."targetType" = 'STORE' AND document."storePublicReference" = item."targetReference" AND document."publicStatus" = 'ACTIVE' AND document."publishedOfferCount" > 0 LIMIT 1) store ON TRUE
      WHERE item."collectionId" = collection."id" AND item."removedAt" IS NULL
    ) targets ON TRUE
    WHERE collection."status" = 'ACTIVE' AND (collection."effectiveFrom" IS NULL OR collection."effectiveFrom" <= CURRENT_TIMESTAMP) AND (collection."effectiveUntil" IS NULL OR collection."effectiveUntil" > CURRENT_TIMESTAMP)
    ORDER BY collection."updatedAt" DESC, collection."name" ASC LIMIT 24
  `);
  return rows.filter((row) => row.itemCount > 0).map((row) => ({
    reference: row.publicReference,
    slug: row.slug,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    type: row.collectionType,
    indexable: row.seoIndexable,
    itemCount: row.itemCount,
    ...(row.coverMediaReference ? { coverMediaReference: row.coverMediaReference } : {}),
  }));
}

type CollectionRow = { publicReference: string; slug: string; name: string; description: string | null; collectionType: string; seoIndexable: boolean };
export async function getStorefrontCollection(slug: string) {
  const rows = await prisma.$queryRaw<CollectionRow[]>(Prisma.sql`SELECT "publicReference", "slug", "name", "description", "collectionType", "seoIndexable" FROM "StorefrontCollection" WHERE "slug" = ${slug} AND "status" = 'ACTIVE' AND ("effectiveFrom" IS NULL OR "effectiveFrom" <= CURRENT_TIMESTAMP) AND ("effectiveUntil" IS NULL OR "effectiveUntil" > CURRENT_TIMESTAMP) LIMIT 1`);
  const row = rows[0];
  if (!row) return null;
  const targets = await prisma.$queryRaw<Array<{ targetType: "CATEGORY" | "PRODUCT" | "VARIANT" | "STORE"; targetReference: string; displayOrder: number; safeLabelOverride: string | null }>>(Prisma.sql`SELECT "targetType", "targetReference", "displayOrder", "safeLabelOverride" FROM "StorefrontCollectionItem" WHERE "collectionId" = (SELECT "id" FROM "StorefrontCollection" WHERE "publicReference" = ${row.publicReference}) AND "removedAt" IS NULL ORDER BY "displayOrder" ASC, "id" ASC LIMIT 100`);
  const productReferences = targets.filter((target) => target.targetType === "PRODUCT").map((target) => target.targetReference);
  const variantReferences = targets.filter((target) => target.targetType === "VARIANT").map((target) => target.targetReference);
  const categoryReferences = targets.filter((target) => target.targetType === "CATEGORY").map((target) => target.targetReference);
  const storeReferences = targets.filter((target) => target.targetType === "STORE").map((target) => target.targetReference);
  const [documents, categoryRows, storeRows] = await Promise.all([
    productReferences.length || variantReferences.length ? loadStorefrontDocuments({ productReferences, variantReferences, limit: 10_000 }) : Promise.resolve([]),
    categoryReferences.length ? prisma.$queryRaw<Array<{ categoryPublicReference: string; canonicalPath: string; name: string; description: string | null; publicImageReference: string | null; productCount: number }>>(Prisma.sql`SELECT "categoryPublicReference", "canonicalPath", "name", "description", "publicImageReference", "productCount" FROM "StorefrontCategoryDocument" WHERE "categoryPublicReference" IN (${Prisma.join([...new Set(categoryReferences)])}) AND "productCount" > 0`) : Promise.resolve([]),
    storeReferences.length ? prisma.$queryRaw<Array<{ storePublicReference: string; slug: string; name: string; shortDescription: string | null; logoMediaReference: string | null; heroMediaReference: string | null; publishedOfferCount: number }>>(Prisma.sql`SELECT "storePublicReference", "slug", "name", "shortDescription", "logoMediaReference", "heroMediaReference", "publishedOfferCount" FROM "StorefrontStoreDocument" WHERE "storePublicReference" IN (${Prisma.join([...new Set(storeReferences)])}) AND "publicStatus" = 'ACTIVE' AND "publishedOfferCount" > 0`) : Promise.resolve([]),
  ]);
  const displayNames = await getStorefrontFacetDisplayNames({ storeSlugs: [...documents.map((document) => document.storeSlug), ...storeRows.map((store) => store.slug)] });
  const namedDocuments = documents.map((document) => ({ ...document, ...(displayNames.stores.get(document.storeSlug) ? { storeName: displayNames.stores.get(document.storeSlug)! } : {}) }));
  const productsByReference = new Map<string, StorefrontDocument[]>();
  const variantsByReference = new Map<string, StorefrontDocument[]>();
  for (const document of namedDocuments) {
    const productOffers = productsByReference.get(document.productReference) ?? [];
    productOffers.push(document);
    productsByReference.set(document.productReference, productOffers);
    const variantOffers = variantsByReference.get(document.variantReference) ?? [];
    variantOffers.push(document);
    variantsByReference.set(document.variantReference, variantOffers);
  }
  const categoriesByReference = new Map(categoryRows.map((category) => [category.categoryPublicReference, category]));
  const storesByReference = new Map(storeRows.map((store) => [store.storePublicReference, store]));
  const items = targets.map((target) => {
    if (target.targetType === "PRODUCT") {
      const offers = productsByReference.get(target.targetReference) ?? [];
      return offers.length ? { targetType: target.targetType, targetReference: target.targetReference, label: target.safeLabelOverride, product: offers[0]!, offers } : null;
    }
    if (target.targetType === "VARIANT") {
      const offers = variantsByReference.get(target.targetReference) ?? [];
      return offers.length ? { targetType: target.targetType, targetReference: target.targetReference, label: target.safeLabelOverride, variant: offers[0], offers } : null;
    }
    if (target.targetType === "CATEGORY") {
      const category = categoriesByReference.get(target.targetReference);
      return category ? { targetType: target.targetType, targetReference: target.targetReference, label: target.safeLabelOverride, category: { path: category.canonicalPath, name: category.name, ...(category.description ? { description: category.description } : {}), ...(category.publicImageReference ? { imageReference: category.publicImageReference } : {}), productCount: category.productCount } } : null;
    }
    if (target.targetType === "STORE") {
      const store = storesByReference.get(target.targetReference);
      return store ? { targetType: target.targetType, targetReference: target.targetReference, label: target.safeLabelOverride, store: { slug: store.slug, name: store.name, ...(store.shortDescription ? { description: store.shortDescription } : {}), ...(store.logoMediaReference ? { logoMediaReference: store.logoMediaReference } : {}), ...(store.heroMediaReference ? { heroMediaReference: store.heroMediaReference } : {}), publishedOfferCount: store.publishedOfferCount, scheduleStatus: "HOURS_UNAVAILABLE" as const } } : null;
    }
    // The enum and service accept only the four explicit types above. A stale
    // database value is omitted rather than becoming a public reference.
    return null;
  });
  const validItems = items.filter(Boolean);
  const coverMediaReference = validItems.map((item) => item?.product?.primaryMedia?.publicReference ?? item?.variant?.primaryMedia?.publicReference ?? item?.category?.imageReference ?? item?.store?.heroMediaReference ?? item?.store?.logoMediaReference).find((reference): reference is string => Boolean(reference));
  return { reference: row.publicReference, slug: row.slug, name: row.name, ...(row.description ? { description: row.description } : {}), type: row.collectionType, indexable: row.seoIndexable, itemCount: validItems.length, ...(coverMediaReference ? { coverMediaReference } : {}), items: validItems };
}
