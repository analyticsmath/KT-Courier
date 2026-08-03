import type { StorefrontAvailabilityState } from "@/lib/storefront/storefront-availability-policy";

export type StorefrontDocument = {
  publicReference: string;
  publicationVersion: string;
  productReference: string;
  productSlug: string;
  productScope: "GLOBAL_CANONICAL" | "STORE_PRIVATE";
  variantReference: string;
  offerReference: string;
  storeReference: string;
  storeSlug: string;
  categoryReference: string;
  categoryPath: string;
  productTypeCode: string;
  productTypeVersion: number;
  brandReference?: string;
  brandName?: string;
  title: string;
  normalizedTitle: string;
  shortDescription?: string;
  description?: string;
  searchText: string;
  searchableAttributes: Record<string, string | number | boolean | string[]>;
  filterableAttributes: Record<string, string | number | boolean | string[]>;
  variantOptions: Record<string, string>;
  condition: "NEW" | "REFURBISHED" | "RECONDITIONED" | "USED";
  fulfilmentMode: "COURIER_DELIVERY" | "STORE_PICKUP" | "PICKUP_AND_DELIVERY";
  sellingUnit: "EACH" | "FIXED_WEIGHT" | "VARIABLE_WEIGHT" | "VOLUME" | "LENGTH";
  price: { publicReference: string; amount: string; currency: "ZAR"; includesTax: true; unitAmount?: string; unit?: string; quantity?: string };
  availability: StorefrontAvailabilityState;
  primaryMedia?: { publicReference: string; width: number; height: number; alt: string };
  publishedAt: string;
  sourceUpdatedAt: string;
  searchable: boolean;
  indexable: boolean;
};

export type StorefrontProductCard = {
  productReference: string;
  productSlug: string;
  title: string;
  brandName?: string;
  primaryMedia?: StorefrontDocument["primaryMedia"];
  representativeVariantReference: string;
  price: { amount: string; currency: "ZAR"; from: boolean };
  variantCount: number;
  storeCount: number;
  availability: StorefrontAvailabilityState;
};

export type StorefrontFacet = { code: string; label: string; values: Array<{ value: string; label: string; count: number; selected: boolean }> };

export type StorefrontLocationContext = {
  serviceAreaReference: string | null;
  suburb?: string;
  postalCode?: string;
  province?: string;
  resolutionStatus: "UNKNOWN" | "RESOLVED" | "UNSUPPORTED" | "AMBIGUOUS";
};

export type StorefrontSearchResponse = {
  normalizedQuery: string;
  correction?: string;
  resultCount: number;
  results: StorefrontProductCard[];
  facets: StorefrontFacet[];
  appliedFilters: Array<{ code: string; value: string; label: string }>;
  nextCursor: string | null;
  noResultState?: "NO_EXACT_RESULTS" | "FILTERS_TOO_RESTRICTIVE" | "NO_LOCAL_AVAILABILITY";
  suggestions: string[];
  queryVersion: "2026-07-18";
  searchIndexVersion: string;
};
