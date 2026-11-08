import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { sumMarketplaceDeliveryAmounts } from "@/lib/marketplace-checkout/delivery-selection.service";

describe("marketplace delivery selection exact monetary arithmetic", () => {
  it("adds multiple ZAR amounts without binary floating point drift", () => {
    expect(sumMarketplaceDeliveryAmounts(["0.10", "0.20", "0.30"])).toBe("0.60");
    expect(sumMarketplaceDeliveryAmounts(["9999999999999999.98", "0.01"])).toBe("9999999999999999.99");
    expect(() => sumMarketplaceDeliveryAmounts(["9999999999999999.99", "0.01"])).toThrow(/supported ZAR limit/i);
    expect(sumMarketplaceDeliveryAmounts([new Prisma.Decimal("7.02"), "0.08", "35.00"])).toBe("42.10");
  });

  it("rejects negative, imprecise, noncanonical and non-monetary values", () => {
    for (const value of ["-0.01", "1.001", "NaN", "1e6", "1", "01.00", new Prisma.Decimal("0.001")]) {
      expect(() => sumMarketplaceDeliveryAmounts([value])).toThrow(/authoritative checkout amount is invalid/i);
    }
  });
});
