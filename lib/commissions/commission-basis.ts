import { Prisma } from "@prisma/client";
import { CommissionError } from "./errors";

const Decimal = Prisma.Decimal;

export type CommissionBasisTypeCode = "ORDER_SUBTOTAL" | "ORDER_TOTAL";
export type CommissionBasisSnapshot = Readonly<{
  subjectType: "COURIER_ORDER" | "MARKETPLACE_STORE_ORDER";
  subjectId: string;
  subjectPublicReference: string;
  pricingReference: string;
  pricingVersion: string;
  subtotal: string;
  tax: string;
  total: string;
  currency: "ZAR";
  authoritativeAt: string;
}>;

const EXACT_MONEY = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

function money(value: string, field: string): Prisma.Decimal {
  if (typeof value !== "string" || !EXACT_MONEY.test(value)) {
    throw new CommissionError("COMMISSION_INVALID_BASIS", `${field} must be an exact non-negative Decimal string.`);
  }
  const parsed = new Decimal(value);
  if (!parsed.isFinite() || parsed.isNaN()) throw new CommissionError("COMMISSION_INVALID_BASIS", `${field} is invalid.`);
  return parsed;
}

export function validateCommissionBasisSnapshot(snapshot: CommissionBasisSnapshot): Readonly<{ subtotal: Prisma.Decimal; tax: Prisma.Decimal; total: Prisma.Decimal }> {
  if (!snapshot || !["COURIER_ORDER", "MARKETPLACE_STORE_ORDER"].includes(snapshot.subjectType) || snapshot.currency !== "ZAR" || !snapshot.subjectId || !snapshot.subjectPublicReference || !snapshot.pricingReference || !snapshot.pricingVersion) {
    throw new CommissionError("COMMISSION_INVALID_BASIS", "The commission basis does not identify immutable ZAR settlement evidence.");
  }
  if (Number.isNaN(Date.parse(snapshot.authoritativeAt))) {
    throw new CommissionError("COMMISSION_INVALID_BASIS", "The commission basis requires an authoritative event time.");
  }
  const subtotal = money(snapshot.subtotal, "subtotal");
  const tax = money(snapshot.tax, "tax");
  const total = money(snapshot.total, "total");
  if (total.lessThanOrEqualTo(0) || !subtotal.add(tax).equals(total)) {
    throw new CommissionError("COMMISSION_INVALID_BASIS", "The immutable pricing values do not form a positive subtotal-plus-tax total.");
  }
  return Object.freeze({ subtotal, tax, total });
}

export function selectCommissionBasis(snapshot: CommissionBasisSnapshot, basisType: CommissionBasisTypeCode): Prisma.Decimal {
  const values = validateCommissionBasisSnapshot(snapshot);
  return basisType === "ORDER_SUBTOTAL" ? values.subtotal : values.total;
}

export function commissionBasisFromOrder(input: Readonly<{
  order: { id: string; orderNumber: string; status: string; pricingQuoteId: string | null };
  quote: { id: string; calculationVersion: string; subtotal: Prisma.Decimal; taxAmount: Prisma.Decimal; total: Prisma.Decimal; currency: string };
  authoritativeAt: Date;
}>): CommissionBasisSnapshot {
  if (!input.order.pricingQuoteId || input.order.pricingQuoteId !== input.quote.id || input.quote.currency !== "ZAR") {
    throw new CommissionError("COMMISSION_INVALID_BASIS", "The order does not have a compatible immutable ZAR pricing quote.");
  }
  if (input.order.status !== "COMPLETED" && input.order.status !== "DELIVERED") {
    throw new CommissionError("COMMISSION_INVALID_BASIS", "The order lifecycle state is not eligible for a future authorized commission settlement.");
  }
  const snapshot: CommissionBasisSnapshot = Object.freeze({
    subjectType: "COURIER_ORDER",
    subjectId: input.order.id,
    subjectPublicReference: input.order.orderNumber,
    pricingReference: input.quote.id,
    pricingVersion: input.quote.calculationVersion,
    subtotal: input.quote.subtotal.toFixed(2),
    tax: input.quote.taxAmount.toFixed(2),
    total: input.quote.total.toFixed(2),
    currency: "ZAR",
    authoritativeAt: input.authoritativeAt.toISOString(),
  });
  validateCommissionBasisSnapshot(snapshot);
  return snapshot;
}
