import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ checkout: vi.fn(), review: vi.fn(), receipt: vi.fn(), reservations: vi.fn(), facts: vi.fn(), evaluate: vi.fn(), reserve: vi.fn(), gate: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { marketplaceCheckout: { findFirst: mock.checkout }, marketplaceCheckoutOperation: { findFirst: mock.review }, promotionOperation: { findUnique: mock.receipt }, promotionReservation: { findMany: mock.reservations }, $transaction: async (work: (tx: object) => unknown) => work({}) } }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: mock.gate }));
vi.mock("@/lib/promotions/promotion-composition-root", () => ({ resolvePromotionProductionComposition: () => ({ evaluate: mock.evaluate }) }));
vi.mock("@/lib/promotions/checkout-promotion-facts", () => ({ projectCheckoutPromotionFacts: mock.facts }));
vi.mock("@/lib/promotions/promotion-reservation.service", () => ({ reserveCheckoutPromotions: mock.reserve }));
import { reservePromotions } from "@/lib/promotions/checkout-promotions.service";

const hash = "a".repeat(64);
const amount = (value: string) => new Prisma.Decimal(value);
const input = { owner: { type: "CUSTOMER" as const, userId: "customer" }, checkoutReference: "checkout-ref", operationId: "reservation-operation" };
beforeEach(() => {
  vi.clearAllMocks();
  mock.checkout.mockResolvedValue({ id: "checkout-id", status: "READY_FOR_REVIEW", reviewVersion: 2, customerUserId: "customer", guestAccessTokenHash: null, commercialFingerprint: "fingerprint", promotionDiscount: amount("5.00"), cart: { appliedPromotionCode: { codeHmac: hash } } });
  mock.facts.mockReturnValue({ checkoutId: "checkout-id", storeGroups: [{ storeReference: "store", lines: [{ lineReference: "line" }] }] });
  mock.evaluate.mockResolvedValue({ totalDiscount: amount("5.00"), applied: [{ campaignVersionId: "version-id", applicationMethod: "COUPON_CODE", calculatedDiscount: amount("5.00"), platformFunding: amount("5.00"), storeFunding: amount("0.00") }], allocations: [{ lineId: "line", basisAmount: amount("20.00"), discountAmount: amount("5.00"), platformFunding: amount("5.00"), storeFunding: amount("0.00") }] });
  mock.review.mockResolvedValue({ response: { commercialFingerprint: "fingerprint", promotionEvidence: { allocations: [{ storeReference: "store", discountAmount: "5.00", platformFunding: "5.00", storeFunding: "0.00" }], evidence: { applied: [{ campaignVersionId: "version-id", calculatedDiscount: "5.00", platformFunding: "5.00", storeFunding: "0.00" }] } } } });
  mock.reserve.mockResolvedValue({ reservationIds: ["reservation"] });
  mock.receipt.mockResolvedValue(null);
});

it("returns the original reservation even when a later evaluation would be unavailable", async () => {
  await reservePromotions(input);
  const requestHash = mock.reserve.mock.calls[0][0].requestHash;
  mock.receipt.mockResolvedValue({ operationType: "RESERVATION", requestHash });
  mock.reservations.mockResolvedValue([{ id: "reservation", requestHash, checkoutId: "checkout-id", checkoutReviewVersion: 2, customerUserId: "customer", campaignVersionId: "version-id", status: "RESERVED", expiresAt: new Date(Date.now() + 60_000), reservedDiscountAmount: amount("5.00"), reservedPlatformFunding: amount("5.00"), reservedStoreFunding: amount("0.00") }]);
  mock.evaluate.mockClear();
  expect(await reservePromotions(input)).toMatchObject({ reservationIds: ["reservation"] });
  expect(mock.evaluate).not.toHaveBeenCalled();
});

it("binds the selected coupon and reviewed amounts to a server-generated request hash", async () => {
  await reservePromotions(input);
  expect(mock.checkout).toHaveBeenCalledWith(expect.objectContaining({ where: { publicReference: "checkout-ref", customerUserId: "customer" } }));
  expect(mock.evaluate).toHaveBeenCalledWith(expect.objectContaining({ appliedCouponCode: hash }));
  expect(mock.reserve).toHaveBeenCalledWith(expect.objectContaining({ appliedCouponCode: hash, requestHash: expect.stringMatching(/^[a-f0-9]{64}$/), checkoutReviewVersion: 2 }), expect.anything());
});

it("refuses a discount whose stored review evidence changed", async () => {
  mock.review.mockResolvedValue({ response: { commercialFingerprint: "fingerprint", promotionEvidence: { evidence: { applied: [{ campaignVersionId: "version-id", calculatedDiscount: "4.00", platformFunding: "4.00", storeFunding: "0.00" }] } } } });
  await expect(reservePromotions(input)).rejects.toThrow("terms changed");
  expect(mock.reserve).not.toHaveBeenCalled();
});

it("refuses a same-total discount shifted to another store", async () => {
  mock.review.mockResolvedValue({ response: { commercialFingerprint: "fingerprint", promotionEvidence: { allocations: [{ storeReference: "other-store", discountAmount: "5.00", platformFunding: "5.00", storeFunding: "0.00" }], evidence: { applied: [{ campaignVersionId: "version-id", calculatedDiscount: "5.00", platformFunding: "5.00", storeFunding: "0.00" }] } } } });
  await expect(reservePromotions(input)).rejects.toThrow("store allocations changed");
  expect(mock.reserve).not.toHaveBeenCalled();
});
