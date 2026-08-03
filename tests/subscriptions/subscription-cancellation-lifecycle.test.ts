/* eslint-disable @typescript-eslint/no-explicit-any -- compact repository seams are intentional DB-free test doubles. */
import { describe, expect, it, vi } from "vitest";
import { applySubscriptionCancellation, requestSubscriptionCancellation, synchronizeProviderCancellation } from "@/lib/subscriptions/subscription-cancellation.service";

describe("subscription rolling cancellation lifecycle", () => {
  it("schedules the paid-period end and safely replays a repeated request", async () => {
    const repository = { requestRollingCancellation: vi.fn().mockResolvedValue({ outcome: "REPLAY", contractReference: "subcon_1", effectiveAt: new Date("2026-08-01T00:00:00Z") }) } as any;
    await expect(requestSubscriptionCancellation(repository, { contractReference: "subcon_1", payerUserId: "user_1", storePayerAuthorised: true, operationId: "cancel_1", legalPolicyVersion: "v1" })).resolves.toMatchObject({ status: "CANCELLATION_SCHEDULED", replayed: true });
  });

  it("persists provider success and routes an unknown provider result to reconciliation", async () => {
    const repository = { loadProviderCancellation: vi.fn().mockResolvedValue({ outcome: "READY", providerAuthority: { authorityReference: "subauth_1", contractReference: "subcon_1", providerSubscriptionReference: "pf_sub_1", tokenFingerprint: null } }), persistProviderCancellation: vi.fn().mockResolvedValue({ outcome: "APPLIED" }) } as any;
    const provider = { cancelRecurringAuthority: vi.fn().mockResolvedValue({ status: "CANCELLED", safeEvidence: { status: "cancelled" } }) } as any;
    await expect(synchronizeProviderCancellation(repository, provider, { contractReference: "subcon_1", operationId: "cancel_2", testApproval: { approved: true } })).resolves.toMatchObject({ outcome: "APPLIED" });
    provider.cancelRecurringAuthority.mockRejectedValueOnce(new Error("timeout"));
    await expect(synchronizeProviderCancellation(repository, provider, { contractReference: "subcon_1", operationId: "cancel_3", testApproval: { approved: true } })).resolves.toMatchObject({ outcome: "RECONCILIATION_REQUIRED" });
  });

  it("only completes cancellation through the effective-date canonical service", async () => {
    const repository = { applyEffectiveCancellation: vi.fn().mockResolvedValue({ outcome: "CANCELLED", expiredGrantCount: 2, cancelledJobCount: 1 }) } as any;
    await expect(applySubscriptionCancellation(repository, { contractReference: "subcon_1", operationId: "cancel_4", at: new Date() })).resolves.toMatchObject({ outcome: "CANCELLED", expiredGrantCount: 2 });
  });
});
