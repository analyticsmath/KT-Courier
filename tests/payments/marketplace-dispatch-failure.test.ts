import { describe, expect, it, vi } from "vitest";
const finalize = vi.hoisted(() => vi.fn());
vi.mock("@/lib/marketplace-checkout/marketplace-checkout-finalization.service", () => ({ finalizePaidMarketplaceCheckout: finalize }));
import { onVerifiedMarketplacePaymentSucceeded, type MarketplacePaymentSuccessHookRepository } from "@/lib/marketplace-checkout/marketplace-payment-success-hook.service";
import type { MarketplaceFinalizationRepository } from "@/lib/marketplace-checkout/marketplace-checkout-finalization.service";

describe("marketplace durable dispatch failure", () => {
  it("records checkout reconciliation and propagates failure to the consumer without retrying finalization", async () => {
    const failure = Object.assign(new Error("Disposable rollback"), { code: "P2034" });
    finalize.mockRejectedValueOnce(failure);
    const repository: MarketplacePaymentSuccessHookRepository = {
      getPaymentSubject: async () => ({ id: "payment", subjectType: "MARKETPLACE_CHECKOUT", userId: "customer", orderId: null, marketplaceCheckoutId: "checkout", marketplaceOrderId: null, checkoutCustomerUserId: "customer", checkoutGuestAccessTokenHash: null }),
      createOrResolveFinalizationReceipt: async input => ({ operationId: input.operationId }),
      markCheckoutReconciliationRequired: vi.fn().mockResolvedValue(undefined),
    };
    await expect(onVerifiedMarketplacePaymentSucceeded(repository, {} as MarketplaceFinalizationRepository, "payment", { approved: true })).rejects.toBe(failure);
    expect(repository.markCheckoutReconciliationRequired).toHaveBeenCalledWith({ checkoutId: "checkout", paymentId: "payment", operationId: "marketplace-finalization:payment", safeReason: "FINALIZATION_APPLICATION_FAILURE" });
    expect(finalize).toHaveBeenCalledOnce();
  });
});
