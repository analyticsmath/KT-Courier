import { findStorefrontCorrection, rankStorefrontDocuments } from "@/lib/storefront/search/storefront-ranking-policy";
import { type StorefrontFilterInput, type StorefrontSort } from "@/lib/storefront/search/storefront-filter-url";
import { normalizeStorefrontQuery } from "@/lib/storefront/search/storefront-query-normalization";
import { expandStorefrontSynonyms, type StorefrontSynonymTerm } from "@/lib/storefront/storefront-editorial-policy";
import { STOREFRONT_SEARCH_INDEX_VERSION, type StorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import type { StorefrontDocument, StorefrontFacet, StorefrontProductCard, StorefrontSearchResponse } from "@/lib/storefront/storefront-types";

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 48;
const CURSOR_VERSION = "organic-v1";

function encodeCursor(offset: number, sort: StorefrontSort): string {
  return Buffer.from(JSON.stringify({ v: CURSOR_VERSION, sort, offset }), "utf8").toString("base64url");
}
function decodeCursor(value: string | undefined, sort: StorefrontSort): number {
  if (!value) return 0;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { v?: string; sort?: string; offset?: unknown };
    return decoded.v === CURSOR_VERSION && decoded.sort === sort && Number.isSafeInteger(decoded.offset) && Number(decoded.offset) >= 0 ? Number(decoded.offset) : 0;
  } catch { return 0; }
}
function values(value: unknown): string[] { return Array.isArray(value) ? value.map(String) : value === undefined ? [] : [String(value)]; }
function hasAny(actual: unknown, wanted: readonly string[] | undefined): boolean { return !wanted?.length || values(actual).some((value) => wanted.includes(value)); }
function safePrice(value: string): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY; }

function matchesFilters(document: StorefrontDocument, filters: StorefrontFilterInput): boolean {
  if (filters.category) {
    const normCategory = filters.category.startsWith("/") ? filters.category : `/${filters.category}`;
    if (document.categoryPath !== normCategory && !document.categoryPath.startsWith(`${normCategory}/`)) return false;
  }
  if (filters.store && document.storeSlug !== filters.store) return false;
  if (filters.brand && document.brandReference !== filters.brand && document.brandName?.toLocaleLowerCase("en-ZA").replace(/\s+/g, "-") !== filters.brand) return false;
  if (filters.minPrice && safePrice(document.price.amount) < safePrice(filters.minPrice)) return false;
  if (filters.maxPrice && safePrice(document.price.amount) > safePrice(filters.maxPrice)) return false;
  if (!hasAny(document.availability, filters.availability)) return false;
  if (!hasAny(document.condition, filters.condition)) return false;
  if (!hasAny(document.fulfilmentMode, filters.fulfilment)) return false;
  return Object.entries(filters.facets ?? {}).every(([code, selected]) => hasAny(document.filterableAttributes[code], selected));
}

function chooseSort(input: StorefrontFilterInput): StorefrontSort {
  if (input.sort === "RELEVANCE" && !input.q) return "NEWEST";
  return input.sort ?? (input.q ? "RELEVANCE" : "NEWEST");
}
function sortDocuments(documents: StorefrontDocument[], input: StorefrontFilterInput): StorefrontDocument[] {
  const sort = chooseSort(input);
  const ranked = rankStorefrontDocuments(documents, input.q);
  if (sort === "RELEVANCE") return ranked.map((item) => item.document);
  return [...documents].sort((left, right) => {
    if (sort === "PRICE_ASC") return safePrice(left.price.amount) - safePrice(right.price.amount) || left.publicReference.localeCompare(right.publicReference);
    if (sort === "PRICE_DESC") return safePrice(right.price.amount) - safePrice(left.price.amount) || left.publicReference.localeCompare(right.publicReference);
    if (sort === "NAME_ASC") return left.title.localeCompare(right.title, "en-ZA") || left.publicReference.localeCompare(right.publicReference);
    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime() || left.publicReference.localeCompare(right.publicReference);
  });
}

function groupProductResults(documents: readonly StorefrontDocument[]): StorefrontProductCard[] {
  const groups = new Map<string, StorefrontDocument[]>();
  for (const document of documents) {
    // Store-private products cannot be grouped with another store's evidence.
    const key = document.productScope === "STORE_PRIVATE" ? `${document.productReference}:${document.storeReference}` : document.productReference;
    groups.set(key, [...(groups.get(key) ?? []), document]);
  }
  return [...groups.values()].map((items) => {
    const sorted = [...items].sort((a, b) => safePrice(a.price.amount) - safePrice(b.price.amount) || a.publicReference.localeCompare(b.publicReference));
    const representative = sorted[0]!;
    const distinctPrices = new Set(items.map((item) => item.price.amount));
    return { productReference: representative.productReference, productSlug: representative.productSlug, title: representative.title, ...(representative.brandName ? { brandName: representative.brandName } : {}), ...(representative.primaryMedia ? { primaryMedia: representative.primaryMedia } : {}), representativeVariantReference: representative.variantReference, price: { amount: representative.price.amount, currency: "ZAR", from: distinctPrices.size > 1 }, variantCount: new Set(items.map((item) => item.variantReference)).size, storeCount: new Set(items.map((item) => item.storeReference)).size, availability: representative.availability };
  });
}

function buildFacets(documents: readonly StorefrontDocument[], filters: StorefrontFilterInput): StorefrontFacet[] {
  const counts = (code: string, label: string, valuesFor: (document: StorefrontDocument) => string[]): StorefrontFacet => {
    const tally = new Map<string, number>();
    for (const document of documents) for (const value of valuesFor(document)) tally.set(value, (tally.get(value) ?? 0) + 1);
    const selected = code === "category" ? filters.category ? [filters.category] : [] : code === "brand" ? filters.brand ? [filters.brand] : [] : code === "store" ? filters.store ? [filters.store] : [] : code === "availability" ? filters.availability ?? [] : code === "condition" ? filters.condition ?? [] : code === "fulfilment" ? filters.fulfilment ?? [] : filters.facets?.[code] ?? [];
    for (const value of selected) if (!tally.has(value)) tally.set(value, 0);
    return { code, label, values: [...tally].map(([value, count]) => ({ value, label: value.replace(/_/g, " "), count, selected: selected.includes(value) })).sort((a, b) => a.label.localeCompare(b.label, "en-ZA")).slice(0, 40) };
  };
  const universal = [
    counts("category", "Category", (document) => [document.categoryPath]),
    counts("brand", "Brand", (document) => document.brandReference ? [document.brandReference] : []),
    counts("store", "Store", (document) => [document.storeSlug]),
    counts("availability", "Availability", (document) => [document.availability]),
    counts("condition", "Condition", (document) => [document.condition]),
    counts("fulfilment", "Fulfilment", (document) => [document.fulfilmentMode]),
  ];
  const dynamicCodes = [...new Set(documents.flatMap((document) => Object.keys(document.filterableAttributes)))].sort().slice(0, 8);
  return [...universal, ...dynamicCodes.map((code) => counts(code, code.replace(/_/g, " "), (document) => values(document.filterableAttributes[code])))].filter((facet) => facet.values.length > 0);
}

function appliedFilters(filters: StorefrontFilterInput): StorefrontSearchResponse["appliedFilters"] {
  const output: StorefrontSearchResponse["appliedFilters"] = [];
  for (const [code, values] of Object.entries({ category: filters.category ? [filters.category] : [], store: filters.store ? [filters.store] : [], brand: filters.brand ? [filters.brand] : [], availability: filters.availability ?? [], condition: filters.condition ?? [], fulfilment: filters.fulfilment ?? [], ...(filters.facets ?? {}) })) for (const value of values) output.push({ code, value, label: `${code.replace(/_/g, " ")}: ${value.replace(/_/g, " ")}` });
  return output;
}

export class StorefrontSearchService {
  constructor(private readonly adapter: StorefrontSearchAdapter, private readonly options: Readonly<{ synonymTerms?: readonly StorefrontSynonymTerm[] }> = {}) {}

  async search(filters: StorefrontFilterInput): Promise<StorefrontSearchResponse> {
    const requested = filters.q ? normalizeStorefrontQuery(filters.q).value : undefined;
    const candidateQueries = requested ? expandStorefrontSynonyms(requested, this.options.synonymTerms ?? []) : [undefined];
    const candidates = await Promise.all(candidateQueries.map((query) => this.adapter.search({
      query,
      storeSlug: filters.store,
      categoryPath: filters.category,
      brand: filters.brand,
      limit: 10000,
    })));
    const documents = [...new Map(candidates.flat().map((document) => [document.publicReference, document])).values()];
    const filtered = documents.filter((document) => matchesFilters(document, filters));
    const sorted = sortDocuments(filtered, { ...filters, q: requested });
    const grouped = groupProductResults(sorted);
    const sort = chooseSort(filters);
    const pageSize = Math.max(1, Math.min(filters.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE));
    let offset = filters.cursor ? decodeCursor(filters.cursor, sort) : ((filters.page ?? 1) - 1) * pageSize;
    if (offset >= grouped.length && grouped.length > 0) { offset = 0; }
    const page = grouped.slice(offset, offset + pageSize);
    const correction = requested && !grouped.length ? findStorefrontCorrection(requested, documents) : undefined;
    const hasFilters = Boolean(Object.keys(filters.facets ?? {}).length || filters.store || filters.brand || filters.availability?.length || filters.condition?.length || filters.fulfilment?.length || filters.minPrice || filters.maxPrice);
    return { normalizedQuery: requested ?? "", ...(correction ? { correction } : {}), resultCount: grouped.length, results: page, facets: buildFacets(documents.filter((document) => matchesFilters(document, { ...filters, facets: {}, availability: undefined, condition: undefined, fulfilment: undefined })), filters), appliedFilters: appliedFilters(filters), nextCursor: offset + pageSize < grouped.length ? encodeCursor(offset + pageSize, sort) : null, ...(grouped.length ? {} : { noResultState: hasFilters ? "FILTERS_TOO_RESTRICTIVE" : "NO_EXACT_RESULTS" as const }), suggestions: grouped.length ? [] : correction ? [correction] : ["Browse categories", "Clear filters"], queryVersion: "2026-07-18", searchIndexVersion: STOREFRONT_SEARCH_INDEX_VERSION };
  }

  async suggest(query: string) {
    const normalized = normalizeStorefrontQuery(query);
    if (normalized.value.length < 2) return { normalizedQuery: normalized.value, products: [], categories: [], brands: [], stores: [], searchIndexVersion: STOREFRONT_SEARCH_INDEX_VERSION };
    const documents = await this.adapter.suggest({ query: normalized.value, limit: 8 });
    const unique = <T>(items: T[], key: (item: T) => string) => items.filter((item, index) => items.findIndex((candidate) => key(candidate) === key(item)) === index);
    return { normalizedQuery: normalized.value, products: unique(documents, (document) => document.productReference).slice(0, 5).map((document) => ({ productReference: document.productReference, productSlug: document.productSlug, title: document.title, variantReference: document.variantReference })), categories: unique(documents, (document) => document.categoryReference).slice(0, 3).map((document) => ({ reference: document.categoryReference, path: document.categoryPath })), brands: unique(documents.filter((document) => document.brandReference && document.brandName), (document) => document.brandReference!).slice(0, 3).map((document) => ({ reference: document.brandReference!, name: document.brandName! })), stores: unique(documents, (document) => document.storeReference).slice(0, 3).map((document) => ({ reference: document.storeReference, slug: document.storeSlug })), searchIndexVersion: STOREFRONT_SEARCH_INDEX_VERSION };
  }
}
