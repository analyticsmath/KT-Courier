import { describe, expect, it, vi } from "vitest";
import {
  consumeVerifiedPaymentEvent,
  type VerifiedPaymentEvent,
  type VerifiedPaymentEventEffects,
  type VerifiedPaymentEventRepository,
} from "@/lib/payments/verified-payment-event-processor.service";

const event: VerifiedPaymentEvent = Object.freeze({
  id: "event-id",
  publicReference: "pve_abcdefghijklmnopqrstuvwx",
  eventIdentity: "payment-verified:pay_abcdefghijklmnop:pwe_abcdefghijklmnop:v1",
  paymentId: "payment-id",
  successfulAttemptId: "attempt-id",
  webhookEventId: "webhook-id",
  subjectType: "MARKETPLACE_CHECKOUT",
});

function repository(claim: "CLAIMED" | "SKIPPED" = "CLAIMED") {
  return {
    claim: vi.fn().mockResolvedValue(claim === "CLAIMED" ? { kind: "CLAIMED", receiptId: "receipt-id" } : { kind: "SKIPPED" }),
    complete: vi.fn().mockResolvedValue(undefined),
    reconcile: vi.fn().mockResolvedValue(undefined),
  } satisfies VerifiedPaymentEventRepository;
}

function effects() {
  return {
    finalizeMarketplacePayment: vi.fn().mockResolvedValue(undefined),
    activateSubscriptionPayment: vi.fn().mockResolvedValue(undefined),
  } satisfies VerifiedPaymentEventEffects;
}

describe("verified payment event processor", () => {
  it("dispatches marketplace finalization exactly through the canonical effect", async () => {
    const repo = repository(); const downstream = effects();
    await expect(consumeVerifiedPaymentEvent(repo, downstream, event)).resolves.toBe("MARKETPLACE_FINALIZED");
    expect(downstream.finalizeMarketplacePayment).toHaveBeenCalledOnce();
    expect(downstream.activateSubscriptionPayment).not.toHaveBeenCalled();
    expect(repo.complete).toHaveBeenCalledWith("receipt-id");
  });

  it("does not rerun a previously claimed event", async () => {
    const repo = repository("SKIPPED"); const downstream = effects();
    await expect(consumeVerifiedPaymentEvent(repo, downstream, event)).resolves.toBe("SKIPPED");
    expect(downstream.finalizeMarketplacePayment).not.toHaveBeenCalled();
    expect(repo.complete).not.toHaveBeenCalled();
  });

  it("routes subscription events without inventing marketplace work", async () => {
    const repo = repository(); const downstream = effects();
    await expect(consumeVerifiedPaymentEvent(repo, downstream, { ...event, subjectType: "SUBSCRIPTION_INVOICE" })).resolves.toBe("SUBSCRIPTION_ACTIVATED");
    expect(downstream.finalizeMarketplacePayment).not.toHaveBeenCalled();
    expect(downstream.activateSubscriptionPayment).toHaveBeenCalledWith(event.paymentId);
  });

  it("records a safe reconciliation receipt when downstream processing fails", async () => {
    const repo = repository(); const downstream = effects();
    downstream.finalizeMarketplacePayment.mockRejectedValueOnce(Object.assign(new Error("finalizer failed"), { code: "CHECKOUT_REVIEW_REQUIRED" }));
    await expect(consumeVerifiedPaymentEvent(repo, downstream, event)).resolves.toBe("RECONCILIATION_REQUIRED");
    expect(repo.reconcile).toHaveBeenCalledWith(event, "receipt-id", "CHECKOUT_REVIEW_REQUIRED");
    expect(repo.complete).not.toHaveBeenCalled();
  });

  it("keeps courier success as a receipt-only event", async () => {
    const repo = repository(); const downstream = effects();
    await expect(consumeVerifiedPaymentEvent(repo, downstream, { ...event, subjectType: "COURIER_ORDER" })).resolves.toBe("NO_DOWNSTREAM_EFFECT");
    expect(downstream.finalizeMarketplacePayment).not.toHaveBeenCalled();
    expect(downstream.activateSubscriptionPayment).not.toHaveBeenCalled();
    expect(repo.complete).toHaveBeenCalledOnce();
  });
});
