import { describe, expect, test } from "vitest";
import { deriveStorefrontAvailability } from "@/lib/storefront/storefront-availability-policy";
describe("public availability policy", () => {
  test("never exposes counts and fails stale stock to confirmation", () => {
    expect(deriveStorefrontAvailability({ trackingMode: "TRACKED", availableQuantities: [1], sourceFresh: true, eligible: true })).toBe("LOW_STOCK");
    expect(deriveStorefrontAvailability({ trackingMode: "TRACKED", availableQuantities: [99], sourceFresh: false, eligible: true })).toBe("CONFIRM_AT_CHECKOUT");
  });
});

