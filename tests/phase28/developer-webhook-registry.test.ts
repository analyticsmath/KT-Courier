/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { WEBHOOK_EVENT_CATALOG } from "@/lib/developer-api/contracts";
import { validateWebhookEndpoint } from "@/lib/developer-api/services";
import { DeveloperWebhookSourceEventService, WEBHOOK_REGISTRY_UNSUPPORTED } from "@/lib/developer-api/webhook-projection";

describe("Phase 28 webhook registry and endpoint authority", () => {
  it("freezes enabled registry metadata and explicitly records unsupported financial sources", () => {
    for (const [type, entry] of Object.entries(WEBHOOK_EVENT_CATALOG)) { expect(type).toMatch(/\.v1$/); expect(entry).toMatchObject({ schemaVersion: 1, enabled: true }); expect(entry.retentionHours).toBeGreaterThan(0); expect(entry.expiryHours).toBeGreaterThan(0); expect(entry.sourceAuthority).toBeTruthy(); expect(entry.sourceEventType).toBeTruthy(); expect(entry.ownershipResolver).toBeTruthy(); expect(entry.projectionAdapter).toBeTruthy(); }
    expect(WEBHOOK_EVENT_CATALOG["za.co.ktcouriers.payment.succeeded.v1"]).toMatchObject({ sourceAuthority: "payment-status-history", sourceEventType: "SUCCEEDED", projectionAdapter: "payment-outcome-v1" });
    expect(WEBHOOK_REGISTRY_UNSUPPORTED["za.co.ktcouriers.refund.failed.v1"]).toContain("no FAILED terminal event");
  });

  it("selects durable source records in deterministic authority/reference order", async () => {
    const rows = (id: string) => vi.fn().mockResolvedValue([{ id }]); const db = { orderStatusHistory: { findMany: rows("b") }, marketplaceStoreOrderEventIntent: { findMany: rows("a") }, orderAssignmentEvent: { findMany: rows("c") }, orderOperationalEvent: { findMany: rows("d") } } as any;
    const selected = await new DeveloperWebhookSourceEventService(db).select(8);
    expect(selected.map((item) => `${item.authority}:${item.reference}`)).toEqual(["order-assignment-event:c", "order-operational-event:d", "order-status-history:b", "store-order-intent:a"]);
  });

  it("rejects unsafe IPv6, metadata, mixed DNS, credentials, and unsafe ports", async () => {
    await expect(validateWebhookEndpoint("https://[::1]/hook")).rejects.toThrow();
    await expect(validateWebhookEndpoint("https://user:pass@example.test/hook", { resolver: async () => [{ address: "8.8.8.8" }] })).rejects.toThrow();
    await expect(validateWebhookEndpoint("https://example.test:8443/hook", { resolver: async () => [{ address: "8.8.8.8" }] })).rejects.toThrow();
    await expect(validateWebhookEndpoint("https://example.test/hook", { resolver: async () => [{ address: "8.8.8.8" }, { address: "169.254.169.254" }] })).rejects.toThrow();
  });
});
