export const STOREFRONT_AVAILABILITY_STATES = [
  "IN_STOCK",
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "MADE_TO_ORDER",
  "UNTRACKED",
  "CONFIRM_AT_CHECKOUT",
  "NOT_AVAILABLE_IN_AREA",
] as const;

export type StorefrontAvailabilityState = (typeof STOREFRONT_AVAILABILITY_STATES)[number];

/** This threshold is deliberately not sent to public clients. */
export const LOW_STOCK_THRESHOLD = 3;

export function deriveStorefrontAvailability(input: {
  trackingMode: "TRACKED" | "UNTRACKED" | "MADE_TO_ORDER";
  availableQuantities?: readonly number[];
  allowBackorder?: boolean;
  sourceFresh?: boolean;
  eligible?: boolean;
}): StorefrontAvailabilityState {
  if (!input.eligible) return "OUT_OF_STOCK";
  if (input.trackingMode === "MADE_TO_ORDER") return "MADE_TO_ORDER";
  if (input.trackingMode === "UNTRACKED") return "UNTRACKED";
  if (!input.sourceFresh) return "CONFIRM_AT_CHECKOUT";

  const available = (input.availableQuantities ?? []).reduce((sum, quantity) => sum + Math.max(0, quantity), 0);
  if (available <= 0) return input.allowBackorder ? "CONFIRM_AT_CHECKOUT" : "OUT_OF_STOCK";
  if (available <= LOW_STOCK_THRESHOLD) return "LOW_STOCK";
  return "IN_STOCK";
}

export function availabilityLabel(value: StorefrontAvailabilityState): string {
  return {
    IN_STOCK: "In stock",
    LOW_STOCK: "Limited availability",
    OUT_OF_STOCK: "Currently unavailable",
    MADE_TO_ORDER: "Made to order",
    UNTRACKED: "Availability to be confirmed",
    CONFIRM_AT_CHECKOUT: "Confirm availability before checkout",
    NOT_AVAILABLE_IN_AREA: "Not available in this area",
  }[value];
}

export const AVAILABILITY_ADVISORY = "Availability is shown for browsing only and will be confirmed before checkout.";

