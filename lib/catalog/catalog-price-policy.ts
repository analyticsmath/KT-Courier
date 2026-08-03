import { CatalogConflictError, CatalogPolicyError } from "@/lib/catalog/errors";

const EXACT_MONEY = /^(?:0|[1-9]\d{0,15})\.\d{2}$/;

export function assertExactZarPrice(value: {
  amount: string;
  currency: string;
  priceIncludesTax: boolean;
}): void {
  if (!EXACT_MONEY.test(value.amount) || BigInt(value.amount.replace(".", "")) <= BigInt(0)) {
    throw new CatalogPolicyError("INVALID_CATALOG_PRICE", "Price must be a positive exact amount with two decimals.");
  }
  if (value.currency !== "ZAR") throw new CatalogPolicyError("CATALOG_PRICE_CURRENCY", "Catalog prices must use ZAR.");
  if (!value.priceIncludesTax) throw new CatalogPolicyError("CATALOG_PRICE_TAX", "Consumer-facing catalog prices must include VAT.");
}

export type PricePeriod = { effectiveFrom: Date; effectiveUntil?: Date | null; status?: string };

export function pricePeriodsOverlap(left: PricePeriod, right: PricePeriod): boolean {
  const leftEnd = left.effectiveUntil?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightEnd = right.effectiveUntil?.getTime() ?? Number.POSITIVE_INFINITY;
  return left.effectiveFrom.getTime() < rightEnd && right.effectiveFrom.getTime() < leftEnd;
}

export function assertPricePeriod(candidate: PricePeriod, existing: PricePeriod[]): void {
  if (candidate.effectiveUntil && candidate.effectiveUntil <= candidate.effectiveFrom) {
    throw new CatalogPolicyError("INVALID_PRICE_PERIOD", "Price end must be after its inclusive start.");
  }
  if (existing.some((period) => pricePeriodsOverlap(candidate, period))) {
    throw new CatalogConflictError("PRICE_PERIOD_OVERLAP", "The price effective period overlaps another scheduled or active price.");
  }
}

