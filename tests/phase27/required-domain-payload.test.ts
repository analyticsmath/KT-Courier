import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { resolveRequiredDomainPayload } from "@/lib/notifications/required-domain-payload";

const asDb = (db: unknown) => db as Prisma.TransactionClient;
const event = (sourceAuthority: string, eventType: string, safePayload: Record<string, unknown> = {}) => ({ sourceAuthority, eventType, aggregateReference: "source", operationId: eventType === "MARKETPLACE_ORDER_CONFIRMED" ? "marketplace-order-notification:source" : eventType === "STORE_ORDER_RECEIVED" ? "vendor-order-notification:source" : `${sourceAuthority === "STORE_ORDERS" ? "store-order" : sourceAuthority === "REFUND" ? "refund-status" : "payment-status"}-notification:${safePayload.sourceEventId}`, safePayload });

describe("canonical required-domain notification payloads", () => {
  it("ignores spoofed marketplace destinations and account identity", async () => {
    const db = asDb({ marketplaceOrder: { findUnique: vi.fn().mockResolvedValue({ customerUserId: "owner", publicReference: "order-public", checkout: { customerUserId: "owner", publicReference: "checkout-public" } }) } });
    const payload = await resolveRequiredDomainPayload(db, event("MARKETPLACE", "MARKETPLACE_ORDER_CONFIRMED", { customerUserId: "attacker", email: "attacker@example.test", orderNumber: "fake" }));
    expect(payload).toEqual({ customerUserId: "owner", checkoutReference: "checkout-public", orderNumber: "order-public" });
  });
  it("rejects mismatched checkout and marketplace order ownership", async () => {
    const db = asDb({ marketplaceOrder: { findUnique: vi.fn().mockResolvedValue({ customerUserId: "owner", checkout: { customerUserId: "other" } }) } });
    await expect(resolveRequiredDomainPayload(db, event("MARKETPLACE", "MARKETPLACE_ORDER_CONFIRMED"))).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
  });
  it("uses the active canonical store owner for vendor order receipts", async () => {
    const db = asDb({ marketplaceStoreOrder: { findUnique: vi.fn().mockResolvedValue({ publicReference: "store-order", store: { status: "ACTIVE", ownerUserId: "vendor" }, marketplaceOrder: { customerUserId: "customer", checkout: { customerUserId: "customer" } } }) } });
    expect(await resolveRequiredDomainPayload(db, event("STORE_ORDERS", "STORE_ORDER_RECEIVED", { storeOwnerUserId: "attacker" }))).toEqual({ storeOwnerUserId: "vendor", orderNumber: "store-order" });
  });
  it("rejects a status event belonging to another store order", async () => {
    const db = asDb({ marketplaceStoreOrder: { findUnique: vi.fn().mockResolvedValue({ id: "source", store: {}, marketplaceOrder: { customerUserId: null, checkout: { customerUserId: null } } }) }, marketplaceStoreOrderEventIntent: { findUnique: vi.fn().mockResolvedValue({ marketplaceStoreOrderId: "foreign", eventType: "STORE_ORDER_ACCEPTED" }) } });
    await expect(resolveRequiredDomainPayload(db, event("STORE_ORDERS", "STORE_ORDER_ACCEPTED", { sourceEventId: "foreign-event" }))).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
  });
  function paymentDb(overrides = {}) {
    return { payment: { findUnique: vi.fn().mockResolvedValue({ id: "payment", publicReference: "pay-public", userId: "customer", orderId: "order", marketplaceCheckoutId: null, status: "SUCCEEDED", successfulAttemptId: "attempt", successWebhookEventId: "webhook", successLedgerJournalId: "journal", amount: new Prisma.Decimal("123.45"), currency: "ZAR", ...overrides }) }, order: { findUnique: vi.fn().mockResolvedValue({ customerId: "customer" }) }, paymentVerifiedEventIntent: { findUnique: vi.fn().mockResolvedValue({ eventIdentity: "verified", successfulAttemptId: "attempt", webhookEventId: "webhook", amount: new Prisma.Decimal("123.45"), currency: "ZAR" }) }, paymentStatusHistory: { findUnique: vi.fn().mockResolvedValue({ paymentId: "payment", toStatus: "FAILED" }) } };
  }
  it("publishes payment success only with the matching verified outbox identity and ledger evidence", async () => {
    const intent = { ...event("PAYMENT", "PAYMENT_SUCCEEDED_VERIFIED", { amount: "99999", email: "spoofed@example.test" }), operationId: "payment-verified-notification:verified" };
    expect(await resolveRequiredDomainPayload(asDb(paymentDb()), intent)).toEqual({ customerUserId: "customer", checkoutReference: null, paymentReference: "pay-public", amount: "123.45" });
    await expect(resolveRequiredDomainPayload(asDb(paymentDb({ successLedgerJournalId: null })), intent)).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
    await expect(resolveRequiredDomainPayload(asDb(paymentDb()), { ...intent, operationId: "forged-success" })).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
  });
  it("rejects missing payment parent records and cross-owner payments", async () => {
    const db = paymentDb(); db.order.findUnique.mockResolvedValue(null);
    await expect(resolveRequiredDomainPayload(asDb(db), event("PAYMENT", "PAYMENT_STATUS_CHANGED", { sourceEventId: "history" }))).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
    db.order.findUnique.mockResolvedValue({ customerId: "foreign" });
    await expect(resolveRequiredDomainPayload(asDb(db), event("PAYMENT", "PAYMENT_STATUS_CHANGED", { sourceEventId: "history" }))).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
  });
  it("derives failed status from canonical history and rejects success via a terminal-status event", async () => {
    const db = paymentDb({ status: "FAILED" });
    expect(await resolveRequiredDomainPayload(asDb(db), event("PAYMENT", "PAYMENT_STATUS_CHANGED", { sourceEventId: "history", status: "SUCCEEDED" }))).toMatchObject({ status: "failed" });
    db.paymentStatusHistory.findUnique.mockResolvedValue({ paymentId: "payment", toStatus: "SUCCEEDED" });
    await expect(resolveRequiredDomainPayload(asDb(db), event("PAYMENT", "PAYMENT_STATUS_CHANGED", { sourceEventId: "history" }))).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
  });
  it("rejects a second operation identity for the same canonical payment history", async () => {
    const intent = { ...event("PAYMENT", "PAYMENT_STATUS_CHANGED", { sourceEventId: "history" }), operationId: "forged-duplicate" };
    await expect(resolveRequiredDomainPayload(asDb(paymentDb({ status: "FAILED" })), intent)).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
  });
  it.each(["MARKETPLACE", "STORE_ORDERS"])("rejects a forged order notification identity in %s", async (authority) => {
    const order = { customerUserId: "owner", publicReference: "order-public", checkout: { customerUserId: "owner", publicReference: "checkout-public" } };
    const db = asDb({ marketplaceOrder: { findUnique: vi.fn().mockResolvedValue(order) }, marketplaceStoreOrder: { findUnique: vi.fn().mockResolvedValue({ store: { status: "ACTIVE", ownerUserId: "vendor" }, marketplaceOrder: order }) } });
    const intent = { ...event(authority, authority === "MARKETPLACE" ? "MARKETPLACE_ORDER_CONFIRMED" : "STORE_ORDER_RECEIVED"), operationId: "forged-duplicate" };
    await expect(resolveRequiredDomainPayload(db, intent)).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
  });
  it("requires canonical completion evidence for refund-success messages", async () => {
    const db = { ...paymentDb(), paymentRefund: { findUnique: vi.fn().mockResolvedValue({ id: "source", customerUserId: "customer", paymentId: "payment", publicReference: "refund-public", amount: new Prisma.Decimal("20.00"), completionLedgerJournalId: null, completedAt: null }) }, refundStatusHistory: { findUnique: vi.fn().mockResolvedValue({ refundId: "source", toStatus: "SUCCEEDED" }) } };
    await expect(resolveRequiredDomainPayload(asDb(db), event("REFUND", "REFUND_STATUS_CHANGED", { sourceEventId: "history" }))).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
  });
});
