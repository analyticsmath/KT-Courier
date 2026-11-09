import { describe, expect, it } from "vitest";
import { humanizeAvailability } from "@/lib/public-marketplace/commerce-presentation";
import { availabilityLabel } from "@/lib/storefront/storefront-availability-policy";

describe("product detail inventory wording agrees with purchase eligibility", () => {
  it.each(["UNTRACKED", "CONFIRM_AT_CHECKOUT"] as const)(
    "never labels unconfirmed %s inventory in stock while disabling the purchase button",
    (availability) => {
      const result = humanizeAvailability(availability);
      expect(result.label).toBe(availabilityLabel(availability));
      expect(result.label).not.toBe("In stock");
      expect(result.isAvailable).toBe(false);
    },
  );

  it.each(["IN_STOCK", "LOW_STOCK"] as const)(
    "allows a stock-confirmed %s product to advertise purchase availability",
    (availability) => {
      const result = humanizeAvailability(availability);
      expect(result.isAvailable).toBe(true);
    },
  );

  it("never claims unavailable inventory is purchasable", () => {
    for (const availability of ["OUT_OF_STOCK", "NOT_AVAILABLE_IN_AREA", null] as const) {
      expect(humanizeAvailability(availability).isAvailable).toBe(false);
    }
  });
});
