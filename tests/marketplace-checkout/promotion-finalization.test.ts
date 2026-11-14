import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mock = vi.hoisted(() => ({ commit: vi.fn(), subsidy: vi.fn() }));
vi.mock("@/lib/promotions/promotion-redemption.service", () => ({ commitMarketplacePromotionRedemptions: mock.commit }));
vi.mock("@/lib/promotions/platform-subsidy-ledger.service", () => ({ postPlatformSubsidyJournalInTx: mock.subsidy }));
import { createPrismaMarketplaceFinalizationRepository } from "@/lib/marketplace-checkout/prisma-marketplace-finalization.repository";
import type { PaidMarketplaceCheckout } from "@/lib/marketplace-checkout/marketplace-checkout-finalization.service";

const checkout = { id: "checkout", publicReference: "checkout-ref", cartId: "cart", status: "PAYMENT_CONFIRMED", currency: "ZAR", promotionDiscount: "10.00", grandTotal: "40.00", digitalRequired: "40.00", cashRequired: "0.00", commercialFingerprint: "accepted-fingerprint", customerUserId: "customer", storeGroups: [] } as PaidMarketplaceCheckout;
const applied = [{ campaignVersionId: "version", calculatedDiscount: "10.00", platformFunding: "6.00", storeFunding: "4.00" }];
function fixture(evidence: unknown) {
  const tx = {
    marketplaceOrder: { create: vi.fn(async () => ({ id: "order", publicReference: "order-ref" })) },
    payment: { update: vi.fn() },
    marketplaceCheckout: { findUniqueOrThrow: vi.fn(async () => ({ reviewVersion: 2, commercialFingerprint: "accepted-fingerprint" })) },
    marketplaceCheckoutOperation: { findFirst: vi.fn(async () => ({ response: { commercialFingerprint: "accepted-fingerprint", promotionDiscount: "10.00", promotionEvidence: evidence } })) },
    promotionReservation: { findMany: vi.fn(async () => [{ id: "reservation" }]) },
  };
  const database = { ...tx, $transaction: async (work: (client: typeof tx) => unknown) => work(tx) };
  const repository = createPrismaMarketplaceFinalizationRepository(database);
  return { tx, run: () => repository.transaction(() => repository.createMarketplaceOrder({ checkout, paymentId: "payment", paymentReference: "payment-ref", guestConfirmationHash: null })) };
}
beforeEach(() => { vi.clearAllMocks(); mock.commit.mockResolvedValue({}); mock.subsidy.mockResolvedValue({}); });

it("commits campaign reservations once without charging store funding as platform subsidy", async () => {
  const item = fixture({ evidence: { applied } });
  await item.run();
  expect(mock.subsidy).not.toHaveBeenCalled();
  expect(mock.commit).toHaveBeenCalledWith(expect.objectContaining({ checkoutId: "checkout", paymentId: "payment", marketplaceOrderId: "order", reservationIds: ["reservation"], frozenEvaluation: expect.objectContaining({ applied: [expect.objectContaining({ platformFunding: new Prisma.Decimal("6.00"), storeFunding: new Prisma.Decimal("4.00") })] }) }), expect.objectContaining({ promotionReservation: item.tx.promotionReservation }));
});

it("rejects promotion evidence that does not add up before posting a subsidy", async () => {
  const item = fixture({ evidence: { applied: [{ ...applied[0], storeFunding: "3.00" }] } });
  await expect(item.run()).rejects.toThrow("do not reconcile");
  expect(mock.commit).not.toHaveBeenCalled();
  expect(mock.subsidy).not.toHaveBeenCalled();
});

it("keeps the independently verified welcome subsidy on its canonical path", async () => {
  const item = fixture({ type: "FIRST_STORE_WELCOME", discountAmount: "10.00" });
  await item.run();
  expect(mock.subsidy).toHaveBeenCalledWith(expect.objectContaining({ marketplaceOrder: item.tx.marketplaceOrder }), expect.objectContaining({ orderId: "order", amount: new Prisma.Decimal("10.00") }));
  expect(mock.commit).not.toHaveBeenCalled();
});
