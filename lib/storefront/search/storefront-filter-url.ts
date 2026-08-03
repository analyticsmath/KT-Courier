import { normalizeStorefrontFacetValue, normalizeStorefrontQuery } from "@/lib/storefront/search/storefront-query-normalization";

export const STOREFRONT_SORTS = ["RELEVANCE", "PRICE_ASC", "PRICE_DESC", "NEWEST", "NAME_ASC"] as const;
export type StorefrontSort = (typeof STOREFRONT_SORTS)[number];

export type StorefrontFilterInput = {
  q?: string;
  category?: string;
  store?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  availability?: string[];
  condition?: string[];
  fulfilment?: string[];
  facets?: Record<string, string[]>;
  sort?: StorefrontSort;
  page?: number;
  cursor?: string;
  pageSize?: number;
};

const SIMPLE_VALUE = /^[a-z0-9][a-z0-9-]{0,95}$/;
const FACET_CODE = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_PARAMS = 24;
const MAX_FACETS = 8;
const MAX_FACET_VALUES = 8;

function cleanSimple(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = normalizeStorefrontFacetValue(value).replace(/\s+/g, "-");
  return SIMPLE_VALUE.test(normalized) ? normalized : undefined;
}

function list(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const values = value.split(",").map(cleanSimple).filter((item): item is string => Boolean(item));
  const unique = [...new Set(values)].sort();
  return unique.length ? unique.slice(0, MAX_FACET_VALUES) : undefined;
}

function money(value: string | null): string | undefined {
  if (!value || !/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : undefined;
}

function positiveInt(value: string | null, max: number): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : undefined;
}

function cleanCategoryPath(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  const normalized = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(normalized) ? normalized : undefined;
}

export function parseStorefrontFilters(params: URLSearchParams): StorefrontFilterInput {
  if ([...params.keys()].length > MAX_PARAMS) return {};
  const q = params.get("q");
  const normalizedQuery = q ? normalizeStorefrontQuery(q).value : undefined;
  const facets: Record<string, string[]> = {};
  for (const [key, value] of params.entries()) {
    if (!key.startsWith("f.")) continue;
    const code = key.slice(2);
    const values = list(value);
    if (FACET_CODE.test(code) && values && Object.keys(facets).length < MAX_FACETS) facets[code] = values;
  }
  const sort = params.get("sort");
  const requestedSort = STOREFRONT_SORTS.includes(sort as StorefrontSort) ? sort as StorefrontSort : undefined;
  const minPrice = money(params.get("minPrice"));
  const maxPrice = money(params.get("maxPrice"));
  return {
    ...(normalizedQuery ? { q: normalizedQuery } : {}),
    ...(cleanCategoryPath(params.get("category")) ? { category: cleanCategoryPath(params.get("category")) } : {}),
    ...(cleanSimple(params.get("store")) ? { store: cleanSimple(params.get("store")) } : {}),
    ...(cleanSimple(params.get("brand")) ? { brand: cleanSimple(params.get("brand")) } : {}),
    ...(minPrice ? { minPrice } : {}),
    ...(maxPrice ? { maxPrice } : {}),
    ...(list(params.get("availability")) ? { availability: list(params.get("availability")) } : {}),
    ...(list(params.get("condition")) ? { condition: list(params.get("condition")) } : {}),
    ...(list(params.get("fulfilment")) ? { fulfilment: list(params.get("fulfilment")) } : {}),
    ...(Object.keys(facets).length ? { facets } : {}),
    ...(requestedSort ? { sort: requestedSort } : {}),
    ...(positiveInt(params.get("page"), 10_000) ? { page: positiveInt(params.get("page"), 10_000) } : {}),
    ...(params.get("cursor") && /^[A-Za-z0-9_-]{1,300}$/.test(params.get("cursor")!) ? { cursor: params.get("cursor")! } : {}),
    ...(positiveInt(params.get("pageSize"), 48) ? { pageSize: positiveInt(params.get("pageSize"), 48) } : {}),
  };
}

export function canonicalStorefrontQuery(input: StorefrontFilterInput): string {
  const params = new URLSearchParams();
  if (input.q) params.set("q", normalizeStorefrontQuery(input.q).value);
  if (input.category) params.set("category", input.category);
  if (input.store) params.set("store", input.store);
  if (input.brand) params.set("brand", input.brand);
  if (input.minPrice) params.set("minPrice", money(input.minPrice) ?? "");
  if (input.maxPrice) params.set("maxPrice", money(input.maxPrice) ?? "");
  if (input.availability?.length) params.set("availability", [...new Set(input.availability.map(normalizeStorefrontFacetValue))].sort().join(","));
  if (input.condition?.length) params.set("condition", [...new Set(input.condition.map(normalizeStorefrontFacetValue))].sort().join(","));
  if (input.fulfilment?.length) params.set("fulfilment", [...new Set(input.fulfilment.map(normalizeStorefrontFacetValue))].sort().join(","));
  for (const [code, values] of Object.entries(input.facets ?? {}).filter(([code]) => FACET_CODE.test(code)).sort(([a], [b]) => a.localeCompare(b))) {
    const normalized = [...new Set(values.map(normalizeStorefrontFacetValue).filter(Boolean))].sort().slice(0, MAX_FACET_VALUES);
    if (normalized.length) params.set(`f.${code}`, normalized.join(","));
  }
  if (input.sort && STOREFRONT_SORTS.includes(input.sort)) params.set("sort", input.sort);
  if (input.page && input.page > 1) params.set("page", String(Math.floor(input.page)));
  if (input.cursor && /^[A-Za-z0-9_-]{1,300}$/.test(input.cursor)) params.set("cursor", input.cursor);
  if (input.pageSize && input.pageSize !== 24 && input.pageSize >= 1 && input.pageSize <= 48) params.set("pageSize", String(Math.floor(input.pageSize)));
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function storefrontFilterHasCrawlRisk(input: StorefrontFilterInput): boolean {
  return Boolean(input.q || input.store || input.brand || input.minPrice || input.maxPrice || input.availability?.length || input.condition?.length || input.fulfilment?.length || Object.keys(input.facets ?? {}).length || input.sort || input.page || input.cursor);
}

