import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/promotions/production-lock", () => ({
  assertPromotionsProductionReady: vi.fn(),
}));
import { evaluateMarketplacePromotions, type CampaignVersionCandidate, type PromotionEvaluationInput } from "@/lib/promotions/promotion-evaluation.service";

const campaign = (): CampaignVersionCandidate => ({
  id: "first-order-version", campaignId: "first-order-campaign", publicReference: "PC-FIRST-1",
  applicationMethod: "AUTOMATIC", discountScope: "ORDER", discountMechanism: "FIXED_AMOUNT",
  percentageValue: null, fixedAmount: new Prisma.Decimal(50), maximumDiscountAmount: null,
  fundingType: "PLATFORM", platformFundingShareBps: null, storeFundingShareBps: null,
  minimumEligibleSubtotal: null, maximumRedemptionsGlobal: null, maximumRedemptionsPerCustomer: 1,
  startsAt: new Date("2026-01-01"), endsAt: new Date("2027-01-01"),
  targets: [], eligibilityRules: [{ rule: "FIRST_MARKETPLACE_ORDER" }],
  currentGlobalRedemptions: 0, currentCustomerRedemptions: 0,
  customerFacingTitle: "First shop purchase", campaignName: "New customer welcome",
});
const base = (): PromotionEvaluationInput => ({
  checkoutId: "checkout-verified", customerUserId: "customer-1",
  storeGroups: [{ storeReference: "store-1", lines: [{
    lineReference: "line-1", merchandiseSubtotal: new Prisma.Decimal("100.00"),
    modifierSubtotal: new Prisma.Decimal("0.00"), productId: "product-1",
    variantId: "variant-1", categoryId: "category-1",
  }] }],
  deliveryQuotes: [], now: new Date("2026-11-08"),
});
const deps = (count?: () => Promise<number>) => ({
  fetchActiveCampaignVersions: async () => [campaign()],
  ...(count ? { fetchPriorCompletedOrdersCount: count } : {}),
});

describe("financial first-store promotion eligibility", () => {
  it("rejects a repeat paid customer even if a campaign has not been redeemed", async () => {
    const historic = vi.fn(async () => 1);
    const result = await evaluateMarketplacePromotions(base(), deps(historic));
    expect(historic).toHaveBeenCalledExactlyOnceWith("customer-1");
    expect(result.applied).toEqual([]);
    expect(result.rejected).toContainEqual({
      campaignVersionId: "first-order-version", reason: "Failed eligibility rule: FIRST_MARKETPLACE_ORDER",
    });
  });
  it("rejects a new customer when source-backed count is absent or invalid", async () => {
    expect((await evaluateMarketplacePromotions(base(), deps())).applied).toEqual([]);
    expect((await evaluateMarketplacePromotions(base(), deps(async () => -1))).applied).toEqual([]);
    expect((await evaluateMarketplacePromotions(base(), deps(async () => 1.5))).applied).toEqual([]);
    expect((await evaluateMarketplacePromotions({ ...base(), customerUserId: undefined }, deps(async () => 0))).applied).toEqual([]);
  });
  it("permits a genuinely first-time paid customer when history is authoritatively zero", async () => {
    const result = await evaluateMarketplacePromotions(base(), deps(async () => 0));
    expect(result.rejected).toEqual([]);
    expect(result.applied).toHaveLength(1);
    expect(result.totalDiscount.toFixed(2)).toBe("50.00");
  });
  it("does not fetch customer history when no campaign requires the first-order rule", async () => {
    const historic = vi.fn(async () => 3);
    const result = await evaluateMarketplacePromotions(base(), {
      fetchActiveCampaignVersions: async () => [{ ...campaign(), eligibilityRules: [] }],
      fetchPriorCompletedOrdersCount: historic,
    });
    expect(historic).not.toHaveBeenCalled();
    expect(result.applied).toHaveLength(1);
  });
});
