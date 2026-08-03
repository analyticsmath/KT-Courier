import { CatalogConflictError } from "@/lib/catalog/errors";

const PRODUCT_TYPE_TRANSITIONS = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["ACTIVE", "RETIRED"],
  ACTIVE: ["RETIRED"],
  RETIRED: [],
  REJECTED: ["DRAFT"],
} as const;

const PRODUCT_TRANSITIONS = {
  DRAFT: ["SUBMITTED", "ARCHIVED"],
  SUBMITTED: ["NEEDS_CHANGES", "APPROVED", "SUSPENDED", "ARCHIVED"],
  NEEDS_CHANGES: ["DRAFT", "SUBMITTED", "ARCHIVED"],
  APPROVED: ["ACTIVE", "SUSPENDED", "ARCHIVED"],
  ACTIVE: ["SUSPENDED", "ARCHIVED"],
  SUSPENDED: ["NEEDS_CHANGES", "ARCHIVED"],
  ARCHIVED: [],
} as const;

const OFFER_TRANSITIONS = {
  DRAFT: ["SUBMITTED", "ARCHIVED"],
  SUBMITTED: ["NEEDS_CHANGES", "ACTIVE", "SUSPENDED"],
  NEEDS_CHANGES: ["DRAFT", "SUBMITTED", "ARCHIVED"],
  ACTIVE: ["PAUSED", "OUT_OF_STOCK", "SUSPENDED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  OUT_OF_STOCK: ["ACTIVE", "PAUSED", "ARCHIVED"],
  SUSPENDED: ["NEEDS_CHANGES", "ARCHIVED"],
  ARCHIVED: [],
} as const;

function assertTransition(table: Record<string, readonly string[]>, from: string, to: string): void {
  if (!(table[from] ?? []).includes(to)) {
    throw new CatalogConflictError("INVALID_CATALOG_TRANSITION", `Catalog transition ${from} -> ${to} is not allowed.`);
  }
}

export function assertProductTypeTransition(from: string, to: string): void {
  assertTransition(PRODUCT_TYPE_TRANSITIONS, from, to);
}

export function assertProductTransition(from: string, to: string): void {
  assertTransition(PRODUCT_TRANSITIONS, from, to);
}

export function assertOfferTransition(from: string, to: string): void {
  assertTransition(OFFER_TRANSITIONS, from, to);
}
