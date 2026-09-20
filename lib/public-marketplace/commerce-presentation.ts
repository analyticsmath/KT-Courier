import type { AvailabilityState } from "@/lib/storefront/storefront-types";

/**
 * Centralized human-readable presentation for marketplace enums and technical strings.
 * Prevents raw snake_case or technical identifiers from leaking into public UI.
 */

export function humanizeFulfilmentMode(mode: string | undefined | null): string {
  if (!mode) return "Standard delivery";
  switch (mode.toUpperCase()) {
    case "COURIER_DELIVERY":
      return "Courier delivery";
    case "STORE_PICKUP":
      return "Store pickup";
    case "PICKUP_AND_DELIVERY":
      return "Pickup & delivery";
    default:
      return mode
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
  }
}

export function humanizeCondition(condition: string | undefined | null): string {
  if (!condition) return "New";
  switch (condition.toUpperCase()) {
    case "NEW":
      return "New";
    case "REFURBISHED":
      return "Refurbished";
    case "RECONDITIONED":
      return "Reconditioned";
    case "USED":
      return "Pre-owned";
    default:
      return condition
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
  }
}

export function humanizeAvailability(availability: AvailabilityState | string | undefined | null): {
  label: string;
  isAvailable: boolean;
  isLowStock: boolean;
} {
  if (!availability) {
    return { label: "Unavailable", isAvailable: false, isLowStock: false };
  }
  switch (availability) {
    case "IN_STOCK":
      return { label: "In stock", isAvailable: true, isLowStock: false };
    case "LOW_STOCK":
      return { label: "Low stock", isAvailable: true, isLowStock: true };
    case "OUT_OF_STOCK":
      return { label: "Out of stock", isAvailable: false, isLowStock: false };
    case "DISCONTINUED":
      return { label: "Discontinued", isAvailable: false, isLowStock: false };
    default:
      return { label: "Temporarily unavailable", isAvailable: false, isLowStock: false };
  }
}

export function formatCommercePrice(amount: string | number, currency: string = "ZAR"): string {
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(numeric)) return "R 0.00";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

/**
 * Formats attribute keys and values for human presentation.
 */
export function humanizeAttributeName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Aggregates product counts across child/descendant categories for parent categories
 * to prevent top-level categories from erroneously displaying "0 products".
 */
export function aggregateCategoryCount(
  categoryPath: string,
  categories: readonly { path: string; productCount?: number }[]
): number {
  const normalizedParent = categoryPath.replace(/^\/+|\/+$/g, "");
  let total = 0;
  let hasChildren = false;

  for (const cat of categories) {
    const normalizedChild = cat.path.replace(/^\/+|\/+$/g, "");
    if (normalizedChild.startsWith(normalizedParent) && normalizedChild !== normalizedParent) {
      hasChildren = true;
      total += cat.productCount ?? 0;
    }
  }

  const directCount = categories.find(
    (c) => c.path.replace(/^\/+|\/+$/g, "") === normalizedParent
  )?.productCount ?? 0;

  return hasChildren ? Math.max(total, directCount) : directCount;
}
