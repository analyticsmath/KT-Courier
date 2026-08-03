import { createHash } from "node:crypto";

export const MARKETPLACE_CURRENCY = "ZAR" as const;
export const MAX_CART_LINES = 60;
export const MAX_CART_STORES = 12;
export const MAX_LINE_QUANTITY = 99;
export const MAX_ACTIVE_RESERVATIONS_PER_OWNER = 2;
export const MARKETPLACE_RESERVATION_POLICY_VERSION = "phase20-v1" as const;

export const CART_TERMINAL_STATUSES = new Set(["CONVERTED", "MERGED", "ABANDONED", "EXPIRED"]);
export const CHECKOUT_TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED", "EXPIRED"]);
export const CHECKOUT_LIVE_STATUSES = new Set([
  "CREATED", "VALIDATING", "CHANGES_REQUIRED", "READY_FOR_REVIEW", "RESERVING", "RESERVED",
  "PAYMENT_PREPARING", "PAYMENT_PENDING", "PAYMENT_CONFIRMED", "COMPLETING", "RECONCILIATION_REQUIRED",
]);

export type CheckoutStatus =
  | "CREATED" | "VALIDATING" | "CHANGES_REQUIRED" | "READY_FOR_REVIEW" | "RESERVING" | "RESERVED"
  | "PAYMENT_PREPARING" | "PAYMENT_PENDING" | "PAYMENT_CONFIRMED" | "COMPLETING" | "COMPLETED"
  | "CANCELLED" | "EXPIRED" | "RECONCILIATION_REQUIRED";

const CHECKOUT_TRANSITIONS: Record<CheckoutStatus, readonly CheckoutStatus[]> = {
  CREATED: ["VALIDATING", "CANCELLED", "EXPIRED"],
  VALIDATING: ["CHANGES_REQUIRED", "READY_FOR_REVIEW", "CANCELLED", "EXPIRED", "RECONCILIATION_REQUIRED"],
  CHANGES_REQUIRED: ["VALIDATING", "CANCELLED", "EXPIRED"],
  READY_FOR_REVIEW: ["VALIDATING", "RESERVING", "CANCELLED", "EXPIRED"],
  RESERVING: ["RESERVED", "CHANGES_REQUIRED", "CANCELLED", "EXPIRED", "RECONCILIATION_REQUIRED"],
  RESERVED: ["PAYMENT_PREPARING", "CANCELLED", "EXPIRED", "RECONCILIATION_REQUIRED"],
  PAYMENT_PREPARING: ["PAYMENT_PENDING", "RESERVED", "RECONCILIATION_REQUIRED"],
  PAYMENT_PENDING: ["PAYMENT_CONFIRMED", "RECONCILIATION_REQUIRED"],
  PAYMENT_CONFIRMED: ["COMPLETING", "RECONCILIATION_REQUIRED"],
  COMPLETING: ["COMPLETED", "RECONCILIATION_REQUIRED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
  RECONCILIATION_REQUIRED: ["PAYMENT_CONFIRMED", "COMPLETING", "CANCELLED", "EXPIRED"],
};

export function mayTransitionCheckout(from: CheckoutStatus, to: CheckoutStatus): boolean {
  return CHECKOUT_TRANSITIONS[from].includes(to);
}

export function assertCheckoutTransition(from: CheckoutStatus, to: CheckoutStatus): void {
  if (!mayTransitionCheckout(from, to)) throw new Error(`CHECKOUT_TRANSITION_INVALID:${from}:${to}`);
}

export function assertCartMutable(status: string): void {
  if (CART_TERMINAL_STATUSES.has(status) || status === "CHECKOUT_LOCKED") {
    throw new Error("CART_MUTATION_NOT_ALLOWED");
  }
}

export function assertSupportedQuantity(quantity: unknown): asserts quantity is number {
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
    throw new Error("CART_QUANTITY_INVALID");
  }
}

export function canonicalMarketplaceFingerprint(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

export function cartLineFingerprint(input: {
  offerReference: string;
  variantReference: string;
  modifiers: readonly { groupReference: string; optionReference: string; quantity: number }[];
}): string {
  return canonicalMarketplaceFingerprint({
    offerReference: input.offerReference,
    variantReference: input.variantReference,
    modifiers: [...input.modifiers].sort((a, b) => `${a.groupReference}:${a.optionReference}`.localeCompare(`${b.groupReference}:${b.optionReference}`)),
  });
}

export function parseZarToCents(value: string): string {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) throw new Error("MONEY_INVALID");
  const [whole, fraction = ""] = value.split(".");
  return `${whole}${(fraction + "00").slice(0, 2)}`.replace(/^0+(?=\d)/, "");
}

function addIntegerStrings(left: string, right: string): string {
  let carry = 0; let output = ""; let l = left.length - 1; let r = right.length - 1;
  while (l >= 0 || r >= 0 || carry) {
    const value = (l >= 0 ? Number(left[l--]) : 0) + (r >= 0 ? Number(right[r--]) : 0) + carry;
    output = `${value % 10}${output}`; carry = Math.floor(value / 10);
  }
  return output.replace(/^0+(?=\d)/, "");
}

export function centsToZar(value: string): string {
  if (!/^\d+$/.test(value)) throw new Error("MONEY_NEGATIVE");
  const normalized = value.padStart(3, "0");
  return `${normalized.slice(0, -2)}.${normalized.slice(-2)}`;
}

export function assertCheckoutTotals(input: {
  merchandiseSubtotal: string; modifierSubtotal: string; deliveryFeeTotal: string; promotionDiscount?: string; grandTotal: string;
}): void {
  const preDiscount = addIntegerStrings(addIntegerStrings(parseZarToCents(input.merchandiseSubtotal), parseZarToCents(input.modifierSubtotal)), parseZarToCents(input.deliveryFeeTotal));
  const expectedCents = Number(preDiscount) - Number(parseZarToCents(input.promotionDiscount || "0.00"));
  if (expectedCents < 0) throw new Error("MONEY_NEGATIVE");
  if (expectedCents.toString() !== parseZarToCents(input.grandTotal)) throw new Error("CHECKOUT_TOTAL_MISMATCH");
}

export function variableWeightCheckoutEligibility(input: { sellingUnit: string; packagedQuantity?: string | null }): "ELIGIBLE" | "VARIABLE_WEIGHT_UNSUPPORTED" {
  return input.sellingUnit === "VARIABLE_WEIGHT" && !input.packagedQuantity ? "VARIABLE_WEIGHT_UNSUPPORTED" : "ELIGIBLE";
}

export function reservationReleaseAllowed(input: { reservationStatus: string; paymentStatus?: string | null; paymentOutcomeKnown: boolean }): boolean {
  if (input.reservationStatus === "CONSUMED") return false;
  if (!input.paymentOutcomeKnown || input.paymentStatus === "PROCESSING" || input.paymentStatus === "PROVIDER_PENDING") return false;
  return input.paymentStatus === null || input.paymentStatus === undefined || ["FAILED", "CANCELLED", "EXPIRED"].includes(input.paymentStatus);
}

export function sellerBasis(input: { merchandiseSubtotal: string; modifierSubtotal: string }): string {
  return centsToZar(addIntegerStrings(parseZarToCents(input.merchandiseSubtotal), parseZarToCents(input.modifierSubtotal)));
}

export function assertSettlementArithmetic(input: { sellerBasis: string; commissionAmount: string; storeEarningAmount: string; deliveryFeeResidual: string }): void {
  if (parseZarToCents(input.sellerBasis) !== addIntegerStrings(parseZarToCents(input.commissionAmount), parseZarToCents(input.storeEarningAmount))) {
    throw new Error("SETTLEMENT_ARITHMETIC_INVALID");
  }
  parseZarToCents(input.deliveryFeeResidual);
}
