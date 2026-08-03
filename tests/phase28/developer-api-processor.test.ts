/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { DeveloperApiMaintenanceService, Phase28ProcessorService } from "@/lib/developer-api/processor-service";

function processorDb() {
  const findMany = vi.fn().mockResolvedValue([{ id: "credential-1", publicReference: "dcred_1", expiresAt: new Date("2026-01-01") }]);
  return {
    developerApplication: { findMany }, developerApiCredential: { findMany, update: vi.fn() }, developerApiIdempotencyRecord: { findMany, update: vi.fn() }, developerApiRateUsage: { findMany, update: vi.fn() }, developerWebhookVerification: { findMany }, developerWebhookDelivery: { findMany }, developerWebhookSubscription: { findMany }, developerApiReconciliationCase: { findMany, update: vi.fn() }, developerApiAuditEvent: { create: vi.fn() },
  } as any;
}

describe("Phase 28 processor authority", () => {
  it("uses bounded deterministic repository selectors instead of fabricated candidates", async () => {
    const db = processorDb(); const sources = { select: vi.fn().mockResolvedValue([{ authority: "order-status-history", reference: "history-1" }]) } as any;
    const processor = new Phase28ProcessorService(db, new DeveloperApiMaintenanceService(db), {} as any, {} as any, {} as any, sources);
    const candidates = await processor.select("expire-credentials", 10);
    expect(candidates).toEqual([expect.objectContaining({ reference: "dcred_1", kind: "expire-credentials" })]);
    expect(db.developerApiCredential.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10, orderBy: [{ expiresAt: "asc" }, { id: "asc" }] }));
    expect(await processor.select("project", 10)).toEqual([expect.objectContaining({ reference: "order-status-history:history-1" })]);
  });

  it("rejects invalid bounds and reaches the readiness lock before lifecycle mutation", async () => {
    const db = processorDb(); const processor = new Phase28ProcessorService(db, new DeveloperApiMaintenanceService(db), {} as any, {} as any, {} as any, { select: vi.fn() } as any);
    await expect(processor.select("deliver", 0)).rejects.toThrow("between 1 and 1000");
    await expect(processor.select("deliver", 1001)).rejects.toThrow("between 1 and 1000");
    await expect(processor.apply("expire-credentials", { reference: "dcred_1", kind: "expire-credentials", record: { id: "credential-1" } })).rejects.toMatchObject({ code: "DEVELOPER_API_CONSOLIDATED_VALIDATION_NOT_APPROVED" });
    expect(db.developerApiCredential.update).not.toHaveBeenCalled();
  });
});
