import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  campaignVersions: vi.fn(),
  code: vi.fn(),
  redemptionCount: vi.fn(),
  evaluate: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    promotionCampaignVersion: { findMany: mocks.campaignVersions },
    promotionCode: { findUnique: mocks.code },
    promotionRedemption: { count: mocks.redemptionCount },
    marketplaceOrder: { count: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/promotions/production-lock", () => ({
  assertPromotionsProductionReady: vi.fn(),
}));
vi.mock("@/lib/promotions/promotion-evaluation.service", () => ({
  evaluateMarketplacePromotions: mocks.evaluate,
}));

import { resolvePromotionProductionComposition } from "@/lib/promotions/promotion-composition-root";
import type { PromotionEvaluationDependencies } from "@/lib/promotions/promotion-evaluation.service";

const now = new Date("2026-11-09T05:00:00.000Z");
const input = {
  checkoutId: "checkout-source", customerUserId: "customer-01",
  storeGroups: [], deliveryQuotes: [], now,
};

async function dependencies(): Promise<PromotionEvaluationDependencies> {
  await resolvePromotionProductionComposition("EVALUATION").evaluate(input);
  const call = mocks.evaluate.mock.lastCall;
  expect(call).toBeDefined();
  return call![1] as PromotionEvaluationDependencies;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.evaluate.mockResolvedValue({ applied: [] });
  mocks.campaignVersions.mockResolvedValue([]);
  mocks.redemptionCount.mockResolvedValue(0);
});

describe("promotion source authorization for welcome and coupon checkout", () => {
  it("never offers coupon-only or unapproved/unfunded campaigns as automatic first-store discounts", async () => {
    const deps = await dependencies();
    expect(await deps.fetchActiveCampaignVersions(now)).toEqual([]);
    expect(mocks.campaignVersions).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        applicationMethod: "AUTOMATIC",
        status: "ACTIVE",
        currency: "ZAR",
        campaign: { status: "ACTIVE" },
        budget: { is: { status: "ACTIVE", currency: "ZAR" } },
      }),
    }));
  });

  it("never evaluates an expired or restricted coupon without owner eligibility", async () => {
    const deps = await dependencies();
    const validVersion = {
      status: "ACTIVE", applicationMethod: "COUPON_CODE",
      campaign: { status: "ACTIVE" }, currency: "ZAR",
      startsAt: new Date("2026-01-01"), endsAt: new Date("2026-12-01"),
    };
    mocks.code.mockResolvedValue({
      id: "code-1", startsAt: null,
      expiresAt: new Date("2026-11-08T05:00:00Z"),
      restrictedCustomerUserId: null,
      maximumRedemptions: null, maximumRedemptionsPerCustomer: null,
      campaignVersion: validVersion,
    });
    expect(await deps.fetchCouponCampaignVersion!("code-hmac")).toBeNull();

    mocks.code.mockResolvedValue({
      id: "code-1", startsAt: null, expiresAt: null,
      restrictedCustomerUserId: "somebody-else",
      maximumRedemptions: null, maximumRedemptionsPerCustomer: null,
      campaignVersion: validVersion,
    });
    expect(await deps.fetchCouponCampaignVersion!("code-hmac")).toBeNull();
    expect(mocks.redemptionCount).not.toHaveBeenCalled();
  });

  it("does not allow an exhausted coupon to exceed its verified source redemption cap", async () => {
    const deps = await dependencies();
    mocks.code.mockResolvedValue({
      id: "code-used", startsAt: null, expiresAt: null,
      restrictedCustomerUserId: null,
      maximumRedemptions: 1, maximumRedemptionsPerCustomer: null,
      campaignVersion: {
        status: "ACTIVE", applicationMethod: "COUPON_CODE",
        campaign: { status: "ACTIVE" }, currency: "ZAR",
        startsAt: new Date("2026-01-01"), endsAt: new Date("2026-12-01"),
      },
    });
    mocks.redemptionCount.mockResolvedValue(1);
    expect(await deps.fetchCouponCampaignVersion!("code-hmac")).toBeNull();
    expect(mocks.redemptionCount).toHaveBeenCalledWith({
      where: { promotionCodeId: "code-used", status: "COMMITTED" },
    });
  });
});
