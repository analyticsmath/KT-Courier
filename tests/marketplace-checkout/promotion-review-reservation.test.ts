import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ review: vi.fn(), reserve: vi.fn(), gate: vi.fn() }));
vi.mock("@/lib/marketplace-checkout/checkout-review-persistence.service", () => ({ reviewMarketplaceCheckout: mock.review, acknowledgeMarketplaceCheckoutReviewPersisted: vi.fn() }));
vi.mock("@/lib/promotions/checkout-promotions.service", () => ({ reservePromotions: mock.reserve }));
vi.mock("@/lib/marketplace-checkout/production-lock", () => ({ assertMarketplaceCheckoutProductionReady: mock.gate }));
vi.mock("@/lib/marketplace-checkout/prisma-review-composition.repository", () => ({ createPrismaMarketplaceReviewRepository: () => ({}), createPrismaMarketplaceAcknowledgementRepository: () => ({}) }));
import { executeMarketplaceCheckoutReview } from "@/lib/marketplace-checkout/composition-root";

const input = { reference: "checkout-ref", owner: { type: "CUSTOMER" as const, userId: "customer" }, operationId: "review-operation", requestHash: "hash", expectedVersion: 1 };
beforeEach(() => { vi.clearAllMocks(); mock.reserve.mockResolvedValue({}); });

it("reserves reviewed campaign promotions with a stable review-bound operation", async () => {
  mock.review.mockResolvedValue({ status: "READY_FOR_REVIEW", reviewVersion: 2, promotionEvidence: { evidence: { applied: [{ campaignVersionId: "version" }] } } });
  await executeMarketplaceCheckoutReview(input);
  const first = mock.reserve.mock.calls[0][0];
  await executeMarketplaceCheckoutReview(input);
  expect(mock.reserve.mock.calls[1][0]).toEqual(first);
  expect(first).toMatchObject({ owner: input.owner, checkoutReference: "checkout-ref", operationId: expect.stringMatching(/^promotion-review:[a-f0-9]{40}$/) });
});

it("does not create campaign reservations for welcome discounts or changed reviews", async () => {
  mock.review.mockResolvedValueOnce({ status: "READY_FOR_REVIEW", reviewVersion: 2, promotionEvidence: { type: "FIRST_STORE_WELCOME" } }).mockResolvedValueOnce({ status: "CHANGES_REQUIRED", reviewVersion: 3, promotionEvidence: { evidence: { applied: [{ campaignVersionId: "version" }] } } });
  await executeMarketplaceCheckoutReview(input);
  await executeMarketplaceCheckoutReview(input);
  expect(mock.reserve).not.toHaveBeenCalled();
});
