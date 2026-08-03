import { describe, expect, it, vi } from "vitest";
import { applyVerifiedSubscriptionRenewal, createNextSubscriptionBillingCycle, prepareSubscriptionRenewalPayment } from "@/lib/subscriptions/subscription-renewal-lifecycle.service";
import { processSubscriptionDunning } from "@/lib/subscriptions/subscription-dunning.service";

describe("subscription renewal and dunning lifecycle", () => {
  it("creates and prepares exact next-period evidence before provider ITN application", async () => {
    const repository = { createNextCycle: vi.fn().mockResolvedValue({ outcome: "CREATED", billingCycleReference: "subcyc_2", invoiceReference: "subinv_2" }), prepareRenewal: vi.fn().mockResolvedValue({ outcome: "PREPARED", authorityReference: "subauth_1", invoiceReference: "subinv_2", paymentReference: "pay_2", amount: "25.00" }), applyVerifiedRenewal: vi.fn().mockResolvedValue({ outcome: "APPLIED" }) };
    await expect(createNextSubscriptionBillingCycle(repository, { contractReference: "subcon_1", operationId: "cycle_2", at: new Date() })).resolves.toMatchObject({ invoiceReference: "subinv_2" });
    await expect(prepareSubscriptionRenewalPayment(repository, { billingCycleReference: "subcyc_2", operationId: "prepare_2" })).resolves.toMatchObject({ paymentReference: "pay_2" });
    await expect(applyVerifiedSubscriptionRenewal(repository, { paymentId: "pay_2", invoiceReference: "subinv_2", operationId: "itn_2" })).resolves.toMatchObject({ outcome: "APPLIED" });
  });
  it("does not blindly retry unknown provider outcomes and applies bounded definite-failure policy", async () => {
    const repository = { applyDunning: vi.fn().mockResolvedValue({ outcome: "GRACE_STARTED", attempts: 3 }) };
    await expect(processSubscriptionDunning(repository, { operationId: "unknown", providerOutcome: "UNKNOWN" })).resolves.toMatchObject({ outcome: "RECONCILIATION_REQUIRED" });
    await expect(processSubscriptionDunning(repository, { operationId: "failed", providerOutcome: "FAILED" })).resolves.toMatchObject({ outcome: "GRACE_STARTED", attempts: 3 });
    expect(repository.applyDunning).toHaveBeenCalledTimes(1);
  });
});
