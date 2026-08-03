/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { DbQuotaService, DbRateLimitService } from "@/lib/developer-api/services";

describe("Phase 28 repository-backed multidimensional rate and quota authorities", () => {
  it("hashes all mandatory rate dimensions and atomically denies an exhausted dimension", async () => {
    const rateUsage = { findUnique: vi.fn().mockResolvedValue({ id: "usage-1", count: 3 }), updateMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn() };
    const service = new DbRateLimitService({ developerApiRateUsage: rateUsage } as any);
    const result = await service.check({ policyId: "policy-1", dimensions: { credential: "credential-fingerprint", application: "dapp_1", resourceOwner: "owner-1", scope: "grant-1", routeClass: "quotes.write", environment: "TEST" }, maximum: 3, windowSeconds: 60, now: new Date("2026-07-27T00:00:30.000Z") });
    expect(result).toEqual({ ok: false, retryAfterSeconds: 30 });
    expect(rateUsage.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "usage-1", count: { lt: 3 } } }));
  });

  it("uses a serializable repository transaction for deterministic quota rollover and blocks owner/environment mismatch", async () => {
    const usage = { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "quota-1" }), update: vi.fn() };
    const db = { $transaction: vi.fn(async (run) => run({ developerApiQuotaUsage: usage })), developerApiQuotaUsage: usage };
    const service = new DbQuotaService(db as any);
    await expect(service.consume({ applicationId: "application-1", ownerUserId: "owner-1", applicationOwnerUserId: "owner-2", environment: "TEST", applicationEnvironment: "TEST", policyId: "quota-policy-1", counter: "requests", maximum: 2 })).rejects.toMatchObject({ code: "API_QUOTA_OWNER_MISMATCH" });
    await expect(service.consume({ applicationId: "application-1", ownerUserId: "owner-1", applicationOwnerUserId: "owner-1", environment: "TEST", applicationEnvironment: "TEST", policyId: "quota-policy-1", counter: "requests", maximum: 2, now: new Date("2026-07-27T12:00:00.000Z") })).resolves.toBe(true);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(usage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ period: "DAY", counters: { requests: 1 } }) }));
  });
});
