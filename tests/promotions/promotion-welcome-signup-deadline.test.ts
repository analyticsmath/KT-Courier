import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { evaluateEligibilityRule } from "@/lib/promotions/promotion-eligibility-policy";

vi.mock("@/lib/promotions/production-lock", () => ({
  assertPromotionsProductionReady: vi.fn(),
}));
import {
  evaluateMarketplacePromotions,
  type CampaignVersionCandidate,
  type PromotionEvaluationInput,
} from "@/lib/promotions/promotion-evaluation.service";

const now = new Date("2026-11-08T12:00:00.000Z");
const candidate = (days: number): CampaignVersionCandidate => ({
  id: "signup-deadline-version", campaignId: "welcome", publicReference: "WELCOME-R50",
  applicationMethod: "AUTOMATIC", discountScope: "ORDER",
  discountMechanism: "FIXED_AMOUNT", fixedAmount: new Prisma.Decimal("50.00"),
  percentageValue: null, maximumDiscountAmount: null,
  fundingType: "PLATFORM", platformFundingShareBps: null, storeFundingShareBps: null,
  minimumEligibleSubtotal: new Prisma.Decimal("75.00"),
  maximumRedemptionsGlobal: null, maximumRedemptionsPerCustomer: 1,
  startsAt: new Date("2026-01-01"), endsAt: new Date("2027-01-01"),
  targets: [], eligibilityRules: [{ rule: "FIRST_MARKETPLACE_ORDER", signupWithinDays: days }],
  currentGlobalRedemptions: 0, currentCustomerRedemptions: 0,
  customerFacingTitle: "First store purchase", campaignName: "Welcome",
});
const input: PromotionEvaluationInput = {
  checkoutId: "checkout-1", customerUserId: "customer-1", now,
  storeGroups: [{ storeReference: "store-1", lines: [{
    lineReference: "line-1",
    merchandiseSubtotal: new Prisma.Decimal("100.00"),
    modifierSubtotal: new Prisma.Decimal(0),
    productId: "product-1", variantId: "variant-1", categoryId: "category-1",
  }] }],
  deliveryQuotes: [],
};
async function evaluate(days: number, signedUpAt: Date | null, previous = 0) {
  return evaluateMarketplacePromotions(input, {
    fetchActiveCampaignVersions: async () => [candidate(days)],
    fetchPriorCompletedOrdersCount: async () => previous,
    fetchCustomerSignupAt: async () => signedUpAt,
  });
}

describe("source-owned registration expiry of first store marketplace offer", () => {
  it("allows the client's 7-day R50 offer when there is no earlier verified paid order", async () => {
    const result = await evaluate(7, new Date(now.getTime() - 6 * 86400000));
    expect(result.applied).toHaveLength(1);
    expect(result.totalDiscount.toFixed(2)).toBe("50.00");
  });
  it("expires the welcome offer after 7 days, without any payment mutation", async () => {
    const expired = await evaluate(7, new Date(now.getTime() - 8 * 86400000));
    expect(expired.applied).toHaveLength(0);
    expect(expired.totalDiscount.toFixed(2)).toBe("0.00");
  });
  it("blocks repeat customers and missing/future source timestamps", async () => {
    expect((await evaluate(7, new Date(now.getTime() - 86400000), 1)).applied).toHaveLength(0);
    expect((await evaluate(7, null)).applied).toHaveLength(0);
    expect((await evaluate(7, new Date(now.getTime() + 5000))).applied).toHaveLength(0);
  });
  it("fails closed on malformed or out-of-bounds configured expiration", async () => {
    expect((await evaluate(0, new Date(now.getTime() - 5000))).applied).toHaveLength(0);
    expect((await evaluate(3651, new Date(now.getTime() - 5000))).applied).toHaveLength(0);
    expect((await evaluate(1.5, new Date(now.getTime() - 5000))).applied).toHaveLength(0);
  });
  it("does not request signup history for ordinary promotions without an age condition", async () => {
    const getSignup = vi.fn(async () => null);
    const result = await evaluateMarketplacePromotions(input, {
      fetchActiveCampaignVersions: async () => [
        { ...candidate(7), eligibilityRules: [{ rule: "FIRST_MARKETPLACE_ORDER" }] },
      ],
      fetchPriorCompletedOrdersCount: async () => 0,
      fetchCustomerSignupAt: getSignup,
    });
    expect(getSignup).not.toHaveBeenCalled();
    expect(result.applied).toHaveLength(1);
  });
  it("enforces expiry using source-owned timestamps at exactly 7 days", () => {
    const base = {
      userId: "customer-1", isGuest: false, priorCompletedOrdersCount: 0,
      hasActiveSubscription: false, deliveryRegion: "", deliveryServiceType: "",
      subtotal: new Prisma.Decimal("100.00"), evaluatedAt: now,
    };
    expect(evaluateEligibilityRule(
      { rule: "FIRST_MARKETPLACE_ORDER", signupWithinDays: 7 },
      { ...base, customerSignedUpAt: new Date(now.getTime() - 7 * 86400000) },
    )).toBe(true);
    expect(evaluateEligibilityRule(
      { rule: "FIRST_MARKETPLACE_ORDER", signupWithinDays: 7 },
      { ...base, customerSignedUpAt: new Date(now.getTime() - 7 * 86400000 - 1) },
    )).toBe(false);
  });
});
