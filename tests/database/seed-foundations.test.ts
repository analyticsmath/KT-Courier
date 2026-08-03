import { describe, expect, it } from "vitest";
import {
  FOUNDATION_AD_PLACEMENTS,
  FOUNDATION_PLATFORM_WALLET,
  FOUNDATION_PLATFORM_LEDGER_ACCOUNTS,
  FOUNDATION_SUBSCRIPTION_PLANS,
} from "@/lib/constants/foundation-models";

describe("Phase 4 foundation seed registry", () => {
  it("represents all required subscription plan codes", () => {
    const codes = FOUNDATION_SUBSCRIPTION_PLANS.map((plan) => plan.code).sort();

    expect(codes).toEqual(["FEATURED", "GROWTH", "PREMIUM", "STARTER"]);
  });

  it("represents all required advertising placement types", () => {
    const placementTypes = FOUNDATION_AD_PLACEMENTS.map((placement) => placement.type).sort();

    expect(placementTypes).toEqual([
      "CATEGORY_PLACEMENT",
      "FEATURED_PRODUCT",
      "FEATURED_STORE",
      "HOMEPAGE_BANNER",
      "SEARCH_PLACEMENT",
    ]);
  });

  it("keeps seedable foundation records in ZAR", () => {
    for (const plan of FOUNDATION_SUBSCRIPTION_PLANS) {
      expect(plan.currency).toBe("ZAR");
      expect(plan.price).toMatch(/^\d+\.\d{2}$/);
    }

    for (const placement of FOUNDATION_AD_PLACEMENTS) {
      expect(placement.currency).toBe("ZAR");
      expect(placement.basePrice).toMatch(/^\d+\.\d{2}$/);
    }

    expect(FOUNDATION_PLATFORM_WALLET).toEqual({
      ownerType: "PLATFORM",
      ownerId: "platform",
      currency: "ZAR",
    });

    expect(FOUNDATION_PLATFORM_LEDGER_ACCOUNTS).toEqual([
      expect.objectContaining({ code: "PLATFORM-CASH-CLEARING-ZAR", currency: "ZAR", allowNegative: false }),
      expect.objectContaining({ code: "PLATFORM-ADJUSTMENT-ZAR", currency: "ZAR", allowNegative: false }),
      expect.objectContaining({ code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY", currency: "ZAR", allowNegative: false }),
      expect.objectContaining({ code: "PLATFORM-COMMISSION-REVENUE-ZAR", purpose: "PLATFORM_REVENUE", category: "REVENUE", currency: "ZAR", allowNegative: false }),
      expect.objectContaining({ code: "PLATFORM-PROMOTION-EXPENSE-ZAR", purpose: "PLATFORM_PROMOTION_EXPENSE", category: "EXPENSE", currency: "ZAR", allowNegative: false }),
    ]);
    expect(new Set(FOUNDATION_PLATFORM_LEDGER_ACCOUNTS.map((account) => account.code)).size).toBe(FOUNDATION_PLATFORM_LEDGER_ACCOUNTS.length);
  });
});
