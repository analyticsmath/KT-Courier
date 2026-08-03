/* eslint-disable @typescript-eslint/no-explicit-any -- compact repository seams are intentional DB-free test doubles. */
import { describe, expect, it, vi } from "vitest";
import { synchronizeSubscriptionProviderAuthority } from "@/lib/subscriptions/subscription-provider-synchronization.service";

describe("subscription provider synchronization", () => {
  const authority = { authorityReference: "subauth_1", contractReference: "subcon_1", providerSubscriptionReference: "pf_sub_1", tokenFingerprint: "fingerprint" };
  it("fetches only an opaque authority and persists matching safe status evidence", async () => {
    const repository = { prepareSynchronization: vi.fn().mockResolvedValue({ outcome: "READY", providerAuthority: authority, internalStatus: "ACTIVE" }), persistSynchronization: vi.fn().mockResolvedValue({ outcome: "SYNCHRONIZED" }), openSynchronizationReconciliation: vi.fn() } as any;
    const provider = { synchronizeRecurringAuthority: vi.fn().mockResolvedValue({ status: "ACTIVE", safeEvidence: { providerReference: "pf_sub_1" } }) } as any;
    await expect(synchronizeSubscriptionProviderAuthority(repository, provider, { authorityReference: "subauth_1", operationId: "sync_1", testApproval: { approved: true } })).resolves.toMatchObject({ outcome: "SYNCHRONIZED" });
    expect(provider.synchronizeRecurringAuthority).toHaveBeenCalledWith(authority);
  });

  it("opens reconciliation for provider/internal mismatch or a missing authority", async () => {
    const reconcile = vi.fn();
    const repository = { prepareSynchronization: vi.fn().mockResolvedValue({ outcome: "READY" }), persistSynchronization: vi.fn(), openSynchronizationReconciliation: reconcile } as any;
    await expect(synchronizeSubscriptionProviderAuthority(repository, {} as any, { authorityReference: "subauth_missing", operationId: "sync_2", testApproval: { approved: true } })).resolves.toMatchObject({ outcome: "RECONCILIATION_REQUIRED" });
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({ reason: "PROVIDER_AUTHORITY_MISSING" }));
  });
});
