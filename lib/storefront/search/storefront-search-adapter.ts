import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { normalizeStorefrontQuery } from "@/lib/storefront/search/storefront-query-normalization";
import type { StorefrontDocument } from "@/lib/storefront/storefront-types";

export const STOREFRONT_SEARCH_INDEX_VERSION = "postgres-organic-v1";

export type StorefrontSearchAdapter = {
  indexDocument(document: StorefrontDocument): Promise<void>;
  removeDocument(publicReference: string): Promise<void>;
  search(input: { query?: string; storeSlug?: string; categoryPath?: string; brand?: string; limit: number }): Promise<StorefrontDocument[]>;
  suggest(input: { query: string; limit: number }): Promise<StorefrontDocument[]>;
  facet(input: { documents: StorefrontDocument[]; code: string }): Promise<Array<{ value: string; count: number }>>;
  health(): Promise<{ ok: boolean; indexVersion: string }>;
};

/** Deterministic adapter for unit/service tests; no network or provider SDK. */
export class InMemoryStorefrontSearchAdapter implements StorefrontSearchAdapter {
  private readonly documents = new Map<string, StorefrontDocument>();

  constructor(initial: readonly StorefrontDocument[] = []) { initial.forEach((document) => this.documents.set(document.publicReference, document)); }
  async indexDocument(document: StorefrontDocument) { this.documents.set(document.publicReference, document); }
  async removeDocument(publicReference: string) { this.documents.delete(publicReference); }
  async search(input: { query?: string; storeSlug?: string; categoryPath?: string; brand?: string; limit: number }) {
    const query = input.query ? normalizeStorefrontQuery(input.query).value : "";
    const normCategoryPath = input.categoryPath ? (input.categoryPath.startsWith("/") ? input.categoryPath : `/${input.categoryPath}`) : "";
    return [...this.documents.values()]
      .filter((document) => !query || document.searchText.toLocaleLowerCase("en-ZA").includes(query) || document.normalizedTitle.includes(query))
      .filter((document) => !input.storeSlug || document.storeSlug === input.storeSlug)
      .filter((document) => !normCategoryPath || document.categoryPath === normCategoryPath || document.categoryPath.startsWith(`${normCategoryPath}/`))
      .filter((document) => !input.brand || document.brandReference === input.brand || document.brandName?.toLocaleLowerCase("en-ZA").replace(/\s+/g, "-") === input.brand)
      .slice(0, input.limit);
  }
  async suggest(input: { query: string; limit: number }) { return this.search({ query: input.query, limit: input.limit }); }
  async facet(input: { documents: StorefrontDocument[]; code: string }) {
    const counts = new Map<string, number>();
    for (const document of input.documents) {
      const value = document.filterableAttributes[input.code];
      for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) counts.set(String(item), (counts.get(String(item)) ?? 0) + 1);
    }
    return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
  }
  async health() { return { ok: true, indexVersion: STOREFRONT_SEARCH_INDEX_VERSION }; }
}

type StorefrontDocumentRow = {
  publicReference: string; publicationVersion: string; productPublicReference: string; productSlug: string; productScope: StorefrontDocument["productScope"]; variantPublicReference: string; offerPublicReference: string; storePublicReference: string; storeSlug: string; categoryPublicReference: string; categoryPath: string; productTypeCode: string; productTypeVersion: number; brandPublicReference: string | null; brandName: string | null; title: string; normalizedTitle: string; shortDescription: string | null; publicDescription: string | null; searchText: string; searchableAttributes: unknown; filterableAttributes: unknown; variantOptions: unknown; condition: StorefrontDocument["condition"]; fulfilmentMode: StorefrontDocument["fulfilmentMode"]; sellingUnit: StorefrontDocument["sellingUnit"]; pricePublicReference: string; priceAmount: { toFixed?: (precision: number) => string } | string | number; currency: "ZAR"; priceIncludesTax: true; unitPriceAmount: { toFixed?: (precision: number) => string } | string | number | null; unitPriceUnit: string | null; unitPriceQuantity: { toFixed?: (precision: number) => string } | string | number | null; availabilityState: StorefrontDocument["availability"]; primaryMediaPublicReference: string | null; primaryMediaWidth: number | null; primaryMediaHeight: number | null; primaryMediaAlt: string | null; publishedAt: Date; sourceUpdatedAt: Date; searchable: boolean; indexable: boolean;
};

function asRecord(value: unknown): Record<string, string | number | boolean | string[]> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, string | number | boolean | string[]> : {};
}
function decimal(value: StorefrontDocumentRow["priceAmount"] | StorefrontDocumentRow["unitPriceAmount"] | StorefrontDocumentRow["unitPriceQuantity"]): string | undefined {
  if (value === null || value === undefined) return undefined;
  return typeof value === "object" && "toFixed" in value && typeof value.toFixed === "function" ? value.toFixed(2) : String(value);
}
export function storefrontRowToDocument(row: StorefrontDocumentRow): StorefrontDocument {
  return {
    publicReference: row.publicReference, publicationVersion: row.publicationVersion, productReference: row.productPublicReference, productSlug: row.productSlug, productScope: row.productScope, variantReference: row.variantPublicReference, offerReference: row.offerPublicReference, storeReference: row.storePublicReference, storeSlug: row.storeSlug, categoryReference: row.categoryPublicReference, categoryPath: row.categoryPath, productTypeCode: row.productTypeCode, productTypeVersion: row.productTypeVersion, ...(row.brandPublicReference ? { brandReference: row.brandPublicReference } : {}), ...(row.brandName ? { brandName: row.brandName } : {}), title: row.title, normalizedTitle: row.normalizedTitle, ...(row.shortDescription ? { shortDescription: row.shortDescription } : {}), ...(row.publicDescription ? { description: row.publicDescription } : {}), searchText: row.searchText, searchableAttributes: asRecord(row.searchableAttributes), filterableAttributes: asRecord(row.filterableAttributes), variantOptions: asRecord(row.variantOptions) as Record<string, string>, condition: row.condition, fulfilmentMode: row.fulfilmentMode, sellingUnit: row.sellingUnit, price: { publicReference: row.pricePublicReference, amount: decimal(row.priceAmount) ?? "0.00", currency: row.currency, includesTax: row.priceIncludesTax, ...(row.unitPriceAmount ? { unitAmount: decimal(row.unitPriceAmount) } : {}), ...(row.unitPriceUnit ? { unit: row.unitPriceUnit } : {}), ...(row.unitPriceQuantity ? { quantity: decimal(row.unitPriceQuantity) } : {}) }, availability: row.availabilityState, ...(row.primaryMediaPublicReference && row.primaryMediaWidth && row.primaryMediaHeight && row.primaryMediaAlt ? { primaryMedia: { publicReference: row.primaryMediaPublicReference, width: row.primaryMediaWidth, height: row.primaryMediaHeight, alt: row.primaryMediaAlt } } : {}), publishedAt: row.publishedAt.toISOString(), sourceUpdatedAt: row.sourceUpdatedAt.toISOString(), searchable: row.searchable, indexable: row.indexable,
  };
}

const SELECT_DOCUMENT = Prisma.sql`SELECT "publicReference", "publicationVersion", "productPublicReference", "productSlug", "productScope", "variantPublicReference", "offerPublicReference", "storePublicReference", "storeSlug", "categoryPublicReference", "categoryPath", "productTypeCode", "productTypeVersion", "brandPublicReference", "brandName", "title", "normalizedTitle", "shortDescription", "publicDescription", "searchText", "searchableAttributes", "filterableAttributes", "variantOptions", "condition", "fulfilmentMode", "sellingUnit", "pricePublicReference", "priceAmount", "currency", "priceIncludesTax", "unitPriceAmount", "unitPriceUnit", "unitPriceQuantity", "availabilityState", "primaryMediaPublicReference", "primaryMediaWidth", "primaryMediaHeight", "primaryMediaAlt", "publishedAt", "sourceUpdatedAt", "searchable", "indexable" FROM "StorefrontProductDocument"`;

/** PostgreSQL-only implementation using parameterised exact, prefix and trigram candidates. */
export class PostgresStorefrontSearchAdapter implements StorefrontSearchAdapter {
  async indexDocument(document: StorefrontDocument) { void document; /* The projection table is the index; writing is owned by the projection service. */ }
  async removeDocument(publicReference: string) { void publicReference; /* Withdrawal is owned by the projection service to retain evidence. */ }
  async search(input: { query?: string; storeSlug?: string; categoryPath?: string; brand?: string; limit: number }): Promise<StorefrontDocument[]> {
    const limit = Math.max(1, Math.min(input.limit, 10000));
    const normalized = input.query ? normalizeStorefrontQuery(input.query).value : "";
    const clauses = [Prisma.sql`"status" = 'ACTIVE'`, Prisma.sql`"searchable" = true`];
    if (input.storeSlug) clauses.push(Prisma.sql`"storeSlug" = ${input.storeSlug}`);
    if (input.categoryPath) {
      const normPath = input.categoryPath.startsWith("/") ? input.categoryPath : `/${input.categoryPath}`;
      clauses.push(Prisma.sql`("categoryPath" = ${normPath} OR "categoryPath" LIKE ${`${normPath}/%`})`);
    }
    if (input.brand) {
      clauses.push(Prisma.sql`("brandPublicReference" = ${input.brand} OR "brandName" ILIKE ${input.brand.replace(/-/g, " ")})`);
    }
    if (normalized) {
      clauses.push(Prisma.sql`("normalizedTitle" LIKE ${`${normalized}%`} OR "searchText" ILIKE ${`%${normalized}%`} OR similarity("searchText", ${normalized}) >= 0.28)`);
    }
    const orderBy = normalized
      ? Prisma.sql`ORDER BY CASE WHEN "normalizedTitle" = ${normalized} THEN 0 WHEN "normalizedTitle" LIKE ${`${normalized}%`} THEN 1 ELSE 2 END, "publicReference" ASC`
      : Prisma.sql`ORDER BY "publishedAt" DESC, "publicReference" ASC`;

    const rows = await prisma.$queryRaw<StorefrontDocumentRow[]>(
      Prisma.sql`${SELECT_DOCUMENT} WHERE ${Prisma.join(clauses, " AND ")} ${orderBy} LIMIT ${limit}`
    );
    return rows.map(storefrontRowToDocument);
  }
  async suggest(input: { query: string; limit: number }) { return this.search({ query: input.query, limit: Math.min(input.limit, 10) }); }
  async facet(input: { documents: StorefrontDocument[]; code: string }) { return new InMemoryStorefrontSearchAdapter(input.documents).facet(input); }
  async health() {
    try { await prisma.$queryRaw`SELECT 1`; return { ok: true, indexVersion: STOREFRONT_SEARCH_INDEX_VERSION }; }
    catch { return { ok: false, indexVersion: STOREFRONT_SEARCH_INDEX_VERSION }; }
  }
}

export async function loadStorefrontDocuments(input: { productReference?: string; variantReference?: string; storeSlug?: string; categoryPath?: string; limit?: number }): Promise<StorefrontDocument[]> {
  const clauses = [Prisma.sql`"status" = 'ACTIVE'`];
  if (input.productReference) clauses.push(Prisma.sql`"productPublicReference" = ${input.productReference}`);
  if (input.variantReference) clauses.push(Prisma.sql`"variantPublicReference" = ${input.variantReference}`);
  if (input.storeSlug) clauses.push(Prisma.sql`"storeSlug" = ${input.storeSlug}`);
  if (input.categoryPath) {
    const normPath = input.categoryPath.startsWith("/") ? input.categoryPath : `/${input.categoryPath}`;
    clauses.push(Prisma.sql`("categoryPath" = ${normPath} OR "categoryPath" LIKE ${`${normPath}/%`})`);
  }
  const rows = await prisma.$queryRaw<StorefrontDocumentRow[]>(Prisma.sql`${SELECT_DOCUMENT} WHERE ${Prisma.join(clauses, " AND ")} ORDER BY "priceAmount" ASC, "publicReference" ASC LIMIT ${Math.max(1, Math.min(input.limit ?? 10000, 10000))}`);
  return rows.map(storefrontRowToDocument);
}
