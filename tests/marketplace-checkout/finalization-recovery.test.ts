import { expect, it, vi } from "vitest";
import { finalizePaidMarketplaceCheckout, type MarketplaceFinalizationRepository } from "@/lib/marketplace-checkout/marketplace-checkout-finalization.service";
import { createPrismaMarketplaceFinalizationRepository } from "@/lib/marketplace-checkout/prisma-marketplace-finalization.repository";

const command = { paymentId: "payment", checkoutId: "checkout", operationId: "marketplace-finalization:payment", testApproval: { approved: true as const } };
function fixture(allowed: boolean) {
  const recover = vi.fn().mockResolvedValue(allowed), resolve = vi.fn(), consume = vi.fn(), create = vi.fn().mockResolvedValue({ id: "order", publicReference: "order-ref" });
  const repository = { transaction: async (work: () => Promise<unknown>) => work(), lockVerifiedSuccessfulPayment: async () => ({ id: "payment", publicReference: "pay-ref", status: "SUCCEEDED", amount: "10.00", currency: "ZAR", marketplaceCheckoutId: "checkout" }), findOrderByCheckout: async () => null, lockCheckout: async () => ({ id: "checkout", publicReference: "checkout-ref", cartId: "cart", status: "RECONCILIATION_REQUIRED", currency: "ZAR", grandTotal: "10.00", commercialFingerprint: "frozen", customerUserId: "customer", storeGroups: [{ storeId: "store", groupTotal: "10.00", lines: [] }] }), mayRecoverFinalization: recover, resolveFinalizationRecovery: resolve, lockReservation: async () => ({ id: "reservation", status: "ACTIVE", commercialFingerprint: "frozen" }), consumeReservation: consume, createMarketplaceOrder: create, createMarketplaceStoreOrder: vi.fn().mockResolvedValue({ id: "store-order", publicReference: "store-order-ref" }), createSettlementSnapshot: vi.fn(), completeCheckoutAndConvertCart: vi.fn() } as unknown as MarketplaceFinalizationRepository;
  return { repository, recover, resolve, consume, create };
}

it("retries a matching finalization case and resolves it only after completing the order", async () => {
  const f = fixture(true);
  await expect(finalizePaidMarketplaceCheckout(f.repository, command)).resolves.toEqual({ publicReference: "order-ref", replayed: false });
  expect(f.recover).toHaveBeenCalledWith(command);
  expect(f.resolve).toHaveBeenCalledWith(command);
  expect(f.resolve.mock.invocationCallOrder[0]).toBeGreaterThan(f.create.mock.invocationCallOrder[0]);
});

it("does not finalize when any independent reconciliation issue prevents recovery", async () => {
  const f = fixture(false);
  await expect(finalizePaidMarketplaceCheckout(f.repository, command)).rejects.toMatchObject({ code: "CHECKOUT_REVIEW_REQUIRED" });
  expect(f.consume).not.toHaveBeenCalled();
  expect(f.resolve).not.toHaveBeenCalled();
});

it("permits only the matching payment failure case and retains unrelated open cases", async () => {
  const findMany = vi.fn(), updateMany = vi.fn();
  const tx = { marketplaceCheckoutReconciliationCase: { findMany, updateMany } };
  const repo = createPrismaMarketplaceFinalizationRepository({ $transaction: async (work: (client: typeof tx) => unknown) => work(tx) });
  const source = { reason: "ORDER_CREATION_FAILURE", paymentId: "payment", operationId: command.operationId };
  findMany.mockResolvedValueOnce([source]).mockResolvedValueOnce([source, { ...source, reason: "PAYMENT_AMOUNT_MISMATCH" }]).mockResolvedValueOnce([{ ...source, paymentId: "other" }]);
  await repo.transaction(async () => {
    expect(await repo.mayRecoverFinalization!(command)).toBe(true);
    expect(await repo.mayRecoverFinalization!(command)).toBe(false);
    expect(await repo.mayRecoverFinalization!(command)).toBe(false);
    await repo.resolveFinalizationRecovery!(command);
  });
  expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ checkoutId: "checkout", paymentId: "payment", reason: "ORDER_CREATION_FAILURE" }), data: expect.objectContaining({ status: "RESOLVED" }) }));
});
