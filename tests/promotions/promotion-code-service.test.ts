import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ checkout: vi.fn(), evaluate: vi.fn(), facts: vi.fn(), gate: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { marketplaceCheckout: { findFirst: mock.checkout } } }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: mock.gate }));
vi.mock("@/lib/promotions/promotion-composition-root", () => ({ resolvePromotionProductionComposition: () => ({ evaluate: mock.evaluate }) }));
vi.mock("@/lib/promotions/checkout-promotion-facts", () => ({ projectCheckoutPromotionFacts: mock.facts }));
import { resolvePromotionCodeForCheckout } from "@/lib/promotions/promotion-code.service";

const previousKey = process.env.PROMOTION_CODE_HMAC_KEY;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.PROMOTION_CODE_HMAC_KEY = "disposable-coupon-service-test-key-123456";
  mock.checkout.mockResolvedValue({ id: "checkout-id" });
  mock.facts.mockReturnValue({ checkoutId: "checkout-id" });
  mock.evaluate.mockResolvedValue({ applied: [{ applicationMethod: "COUPON_CODE", publicReference: "campaign-ref", calculatedDiscount: new Prisma.Decimal("5.00"), customerFacingTitle: "Offer" }] });
});
afterEach(() => { if (previousKey === undefined) delete process.env.PROMOTION_CODE_HMAC_KEY; else process.env.PROMOTION_CODE_HMAC_KEY = previousKey; });

it("evaluates only an owner-scoped checkout and passes a keyed code digest", async () => {
  const result = await resolvePromotionCodeForCheckout("offer-123", { checkoutReference: "checkout-ref", owner: { type: "CUSTOMER", userId: "customer-id" } });
  expect(mock.checkout).toHaveBeenCalledWith(expect.objectContaining({ where: { publicReference: "checkout-ref", customerUserId: "customer-id" } }));
  expect(mock.evaluate).toHaveBeenCalledWith(expect.objectContaining({ checkoutId: "checkout-id", appliedCouponCode: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  expect(result).toEqual({ versionReference: "campaign-ref", discountAmount: "5.00", title: "Offer" });
});

it("does not evaluate a foreign checkout or reveal a code outcome", async () => {
  mock.checkout.mockResolvedValue(null);
  await expect(resolvePromotionCodeForCheckout("offer123", { checkoutReference: "foreign", owner: { type: "GUEST", guestTokenHash: "guest-hash" } })).rejects.toThrow("Checkout not found");
  expect(mock.checkout).toHaveBeenCalledWith(expect.objectContaining({ where: { publicReference: "foreign", customerUserId: null, guestAccessTokenHash: "guest-hash" } }));
  expect(mock.evaluate).not.toHaveBeenCalled();
});
