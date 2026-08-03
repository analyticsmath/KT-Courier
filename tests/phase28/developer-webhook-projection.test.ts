/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { DeveloperWebhookProjectionService } from "@/lib/developer-api/webhook-projection";
import { DeveloperWebhookSourceEventService } from "@/lib/developer-api/webhook-projection";

describe("Phase 28 public webhook projection", () => {
  it("creates a privacy-minimised immutable event and fans out only to exact eligible subscriptions", async () => {
    const event = { id: "event-1", publicReference: "dwhe_1", ownerUserId: "owner-1", storeId: null, expiresAt: new Date("2027-01-01") };
    const db = {
      developerWebhookPublicEvent: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(event), update: vi.fn() },
      developerApplication: { findMany: vi.fn().mockResolvedValue([{ id: "app-1", publicReference: "dapp_1", environment: "TEST", approvedOwnerSnapshot: { ownerUserId: "owner-1", storeId: null } }]) }, user: { findUnique: vi.fn().mockResolvedValue({ status: "ACTIVE" }) },
      developerScopeGrant: { findMany: vi.fn().mockResolvedValue([{ version: 1, scopes: ["orders:read"] }]) }, developerWebhookSubscription: { findMany: vi.fn().mockResolvedValue([{ id: "subscription-1", publicReference: "dwh_1", eventSelection: ["za.co.ktcouriers.order.created.v1"], version: 2 }]) },
      developerWebhookSecret: { findFirst: vi.fn().mockResolvedValue({ version: 3 }) }, developerWebhookDelivery: { create: vi.fn().mockResolvedValue({ id: "delivery-1" }) }, developerApiReconciliationCase: { findFirst: vi.fn(), create: vi.fn() },
    } as any;
    const source = { resolve: vi.fn().mockResolvedValue({ sourceAuthority: "order-status-history", sourceEventReference: "history-1", eventType: "za.co.ktcouriers.order.created.v1", subjectReference: "KT-2026-ORDER", ownerUserId: "owner-1", storeId: null, occurredAt: new Date("2026-01-01"), payload: { reference: "KT-2026-ORDER", status: "PENDING", occurredAt: "2026-01-01T00:00:00.000Z" } }) } as any;
    const projected = await new DeveloperWebhookProjectionService(db, source).project({ authority: "order-status-history", reference: "history-1" });
    expect(projected).toBe(event);
    expect(db.developerWebhookPublicEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sourceAuthority: "order-status-history", eventType: "za.co.ktcouriers.order.created.v1", ownerUserId: "owner-1" }) }));
    expect(db.developerWebhookDelivery.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ publicEventId: "event-1", subscriptionId: "subscription-1", endpointVersion: 2, secretVersion: 3 }) }));
  });

  it("rejects a replay whose frozen public projection differs", async () => {
    const db = { developerWebhookPublicEvent: { findUnique: vi.fn().mockResolvedValue({ payloadHash: "other", ownerUserId: "owner-1", storeId: null }) } } as any;
    const source = { resolve: vi.fn().mockResolvedValue({ sourceAuthority: "order-status-history", sourceEventReference: "history-1", eventType: "za.co.ktcouriers.order.created.v1", subjectReference: "KT-2026-ORDER", ownerUserId: "owner-1", storeId: null, occurredAt: new Date(), payload: { reference: "KT-2026-ORDER" } }) } as any;
    await expect(new DeveloperWebhookProjectionService(db, source).project({ authority: "order-status-history", reference: "history-1" })).rejects.toMatchObject({ code: "WEBHOOK_PUBLIC_EVENT_CONFLICT" });
  });

  it("maps a canonical payment status history into a safe, owner-bound public event", async () => {
    const at = new Date("2026-07-27T01:02:03.000Z");
    const db = { paymentStatusHistory: { findUnique: vi.fn().mockResolvedValue({ id: "payment-history-1", toStatus: "FAILED", createdAt: at, attempt: { failureCategory: "DECLINED", providerReference: "must-not-leak" }, payment: { publicReference: "pay_public_1", userId: "customer-1", amount: { toFixed: () => "12.50" }, currency: "ZAR", order: { orderNumber: "KT-2026-ORDER" }, metadata: { card: "must-not-leak" } } }) } } as any;
    const result = await new DeveloperWebhookSourceEventService(db).resolve({ authority: "payment-status-history", reference: "payment-history-1" });
    expect(result).toMatchObject({ sourceAuthority: "payment-status-history", eventType: "za.co.ktcouriers.payment.failed.v1", ownerUserId: "customer-1", payload: { paymentReference: "pay_public_1", orderReference: "KT-2026-ORDER", status: "failed", currency: "ZAR", amount: "12.50", failureCategory: "DECLINED" } });
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
  });

  it("maps canonical refund and subscription intent records without becoming their authority", async () => {
    const at = new Date("2026-07-27T01:02:03.000Z");
    const db = {
      refundStatusHistory: { findUnique: vi.fn().mockResolvedValue({ id: "refund-history-1", toStatus: "SUCCEEDED", createdAt: at, refund: { publicReference: "refund_public_1", customerUserId: "customer-1", amount: { toFixed: () => "8.00" }, currency: "ZAR", completedAt: at, payment: { publicReference: "pay_public_1", order: { orderNumber: "KT-2026-ORDER" } } } }) },
      subscriptionEventIntent: { findUnique: vi.fn().mockResolvedValue({ id: "subscription-intent-1", type: "SUBSCRIPTION_CANCELLED", createdAt: at, safePayload: { effectiveAt: at.toISOString(), planReference: "plan_public_1" }, contract: { publicReference: "subscription_public_1", customerUserId: "customer-1", storeId: null, cancellationEffectiveAt: at } }) },
    } as any;
    const source = new DeveloperWebhookSourceEventService(db);
    await expect(source.resolve({ authority: "refund-status-history", reference: "refund-history-1" })).resolves.toMatchObject({ eventType: "za.co.ktcouriers.refund.completed.v1", ownerUserId: "customer-1", payload: { refundReference: "refund_public_1", paymentReference: "pay_public_1", amount: "8.00" } });
    await expect(source.resolve({ authority: "subscription-event-intent", reference: "subscription-intent-1" })).resolves.toMatchObject({ eventType: "za.co.ktcouriers.subscription.cancelled.v1", ownerUserId: "customer-1", payload: { subscriptionReference: "subscription_public_1", planReference: "plan_public_1", cancellationEffectiveAt: at.toISOString() } });
  });
});
