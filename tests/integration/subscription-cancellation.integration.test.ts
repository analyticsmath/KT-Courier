import { describe, expect, it } from "vitest";
import { rollingCancellationEffectiveAt } from "@/lib/subscriptions/contract-policy";
import { requestSubscriptionCancellation, type SubscriptionCancellationRepository } from "@/lib/subscriptions/subscription-cancellation.service";
import { SubscriptionError } from "@/lib/subscriptions/errors";

describe("Subscription Cancellation Domain Integration Tests", () => {
  it("enforces rolling cancellation is effective at paid-period end", () => {
    const periodEnd = new Date("2026-12-31T23:59:59Z");
    const effective = rollingCancellationEffectiveAt(periodEnd);
    expect(effective.toISOString()).toBe(periodEnd.toISOString());

    expect(() => rollingCancellationEffectiveAt(null)).toThrowError(SubscriptionError);
  });

  it("requires non-empty operationId when requesting cancellation", async () => {
    const fakeRepo: SubscriptionCancellationRepository = {
      requestRollingCancellation: async () => ({
        outcome: "SCHEDULED",
        contractReference: "SUB-1",
        effectiveAt: new Date(),
      }),
      loadProviderCancellation: async () => ({ outcome: "NOT_REQUIRED" }),
      persistProviderCancellation: async () => ({ outcome: "APPLIED" }),
      applyEffectiveCancellation: async () => ({ outcome: "CANCELLED" }),
    };

    await expect(
      requestSubscriptionCancellation(fakeRepo, {
        contractReference: "SUB-1",
        payerUserId: "user-1",
        storePayerAuthorised: false,
        operationId: "   ",
        legalPolicyVersion: "v1",
      })
    ).rejects.toThrowError(SubscriptionError);
  });

  it("returns CANCELLATION_SCHEDULED with effectiveAt date", async () => {
    const periodEnd = new Date("2026-11-30T23:59:59Z");
    const fakeRepo: SubscriptionCancellationRepository = {
      requestRollingCancellation: async () => ({
        outcome: "SCHEDULED",
        contractReference: "SUB-100",
        effectiveAt: periodEnd,
      }),
      loadProviderCancellation: async () => ({ outcome: "NOT_REQUIRED" }),
      persistProviderCancellation: async () => ({ outcome: "APPLIED" }),
      applyEffectiveCancellation: async () => ({ outcome: "CANCELLED" }),
    };

    const result = await requestSubscriptionCancellation(fakeRepo, {
      contractReference: "SUB-100",
      payerUserId: "user-1",
      storePayerAuthorised: false,
      operationId: "op-cancel-1",
      legalPolicyVersion: "v1",
    });

    expect(result.contractReference).toBe("SUB-100");
    expect(result.status).toBe("CANCELLATION_SCHEDULED");
    expect(result.effectiveAt).toBe(periodEnd.toISOString());
    expect(result.reconciliationRequired).toBe(false);
  });
});
