import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimEmailAttempt, emailWorkWhere, EMAIL_SAFE_REPLAY_MS, EMAIL_SENDING_STALE_MS, finishEmailAttempt, recoverStalledEmailDeliveries } from "@/lib/notifications/email-delivery-recovery";
import { createNotificationMemoryDb } from "./helpers/in-memory-notification-db";

vi.mock("@/lib/notifications/production-readiness", () => ({ assertNotificationProductionReady: vi.fn() }));
const at = new Date("2026-10-07T00:00:00Z");
const stale = new Date(at.getTime() - EMAIL_SENDING_STALE_MS - 1);
const base = { id: "delivery", publicReference: "delivery-public", messageId: "message", recipientUserId: "user", channel: "EMAIL", status: "SENDING", updatedAt: stale, renderedBody: "redacted", expiresAt: null };
const attempt = { id: "attempt", publicReference: "attempt-public", deliveryId: "delivery", attemptNumber: 1, operationId: "operation:1", provider: "RESEND_EMAIL", status: "STARTED", startedAt: stale };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(at); });
afterEach(() => { vi.useRealTimers(); });

describe("bounded email interruption recovery", () => {
  it("makes a stale Resend claim retryable without a provider call", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [base], notificationDeliveryAttempt: [attempt] });
    expect(await recoverStalledEmailDeliveries(db, 50)).toEqual({ examined: 1, recovered: 1, reconciled: 0 });
    expect(db.__state.notificationDelivery[0]).toMatchObject({ status: "FAILED_RETRYABLE", nextAttemptAt: at });
    expect(db.__state.notificationDeliveryAttempt[0]).toMatchObject({ status: "FAILED", safeProviderCode: "EMAIL_SEND_INTERRUPTED" });
    expect(await recoverStalledEmailDeliveries(db, 50)).toEqual({ examined: 0, recovered: 0, reconciled: 0 });
  });
  it("leaves fresh sending claims and other channels untouched", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [{ ...base, updatedAt: at }, { ...base, id: "sms", channel: "SMS" }] });
    expect((await recoverStalledEmailDeliveries(db, 50)).examined).toBe(0);
    expect(db.__state.notificationDelivery.every((row: { status: string }) => row.status === "SENDING")).toBe(true);
  });
  it("requires review at the conservative replay boundary rather than duplicating an old email", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [base], notificationDeliveryAttempt: [{ ...attempt, startedAt: new Date(at.getTime() - EMAIL_SAFE_REPLAY_MS) }] });
    expect((await recoverStalledEmailDeliveries(db, 50)).reconciled).toBe(1);
    expect(db.__state.notificationDelivery[0]).toMatchObject({ status: "FAILED_PERMANENT", eligibilityReason: "PROVIDER_IDEMPOTENCY_WINDOW_EXCEEDED", nextAttemptAt: null });
    expect(db.__state.notificationReconciliationCase[0]).toMatchObject({ deliveryId: base.id, reason: "DELIVERY_STALLED" });
  });
  it.each(["missing", "unknown", "exhausted"])("requires reconciliation for %s attempt evidence", async (mode) => {
    const attempts = mode === "missing" ? [] : mode === "unknown" ? [{ ...attempt, provider: "OTHER_PROVIDER" }] : Array.from({ length: 5 }, (_, i) => ({ ...attempt, id: `attempt-${i}`, attemptNumber: i + 1 }));
    const db = createNotificationMemoryDb({ notificationDelivery: [base], notificationDeliveryAttempt: attempts });
    expect((await recoverStalledEmailDeliveries(db, 50)).reconciled).toBe(1);
    expect(db.__state.notificationDelivery[0].status).toBe("FAILED_PERMANENT");
  });
  it("restores durable acceptance without resending, even after expiry", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [{ ...base, expiresAt: stale }], notificationDeliveryAttempt: [{ ...attempt, status: "PROVIDER_ACCEPTED", providerMessageReference: "provider-receipt" }] });
    await recoverStalledEmailDeliveries(db, 50);
    expect(db.__state.notificationDelivery[0]).toMatchObject({ status: "PROVIDER_ACCEPTED", providerMessageReference: "provider-receipt" });
  });
  it("expires stale unaccepted work rather than retrying an old OTP", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [{ ...base, expiresAt: at }], notificationDeliveryAttempt: [attempt] });
    await recoverStalledEmailDeliveries(db, 50);
    expect(db.__state.notificationDelivery[0]).toMatchObject({ status: "EXPIRED", nextAttemptAt: null });
    expect(db.__state.notificationReconciliationCase).toHaveLength(0);
  });
  it("also prevents ordinary delayed retries beyond the provider window", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [{ ...base, status: "FAILED_RETRYABLE" }], notificationDeliveryAttempt: [{ ...attempt, status: "FAILED", startedAt: new Date(at.getTime() - EMAIL_SAFE_REPLAY_MS) }] });
    expect(await claimEmailAttempt(db, { deliveryId: base.id, provider: "RESEND_EMAIL", operationId: "retry" })).toBeNull();
    expect(db.__state.notificationDelivery[0].status).toBe("FAILED_PERMANENT");
    expect(db.__state.notificationDeliveryAttempt).toHaveLength(1);
  });
  it("does not overwrite a newer terminal state with a late provider response", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [{ ...base, status: "QUEUED" }] });
    const claim = await claimEmailAttempt(db, { deliveryId: base.id, provider: "RESEND_EMAIL", operationId: "first" });
    if (!claim) throw new Error("Missing fixture claim");
    await db.notificationDelivery.update({ where: { id: base.id }, data: { status: "CANCELLED" } });
    const result = await finishEmailAttempt(db, claim, { accepted: true, providerMessageReference: "late" });
    expect(result.applied).toBe(false);
    expect(result.delivery.status).toBe("CANCELLED");
    expect(db.__state.notificationDeliveryAttempt[0].status).toBe("STARTED");
  });
  it("includes stale sending work in the worker wakeup query", () => {
    expect(emailWorkWhere(at)).toMatchObject({ channel: "EMAIL", OR: expect.arrayContaining([{ status: "SENDING", updatedAt: { lte: new Date(at.getTime() - EMAIL_SENDING_STALE_MS) } }]) });
  });
  it("fences by attempt identity even when a newer claim has the identical clock timestamp", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [{ ...base, status: "QUEUED" }] });
    const old = await claimEmailAttempt(db, { deliveryId: base.id, provider: "RESEND_EMAIL", operationId: "old" });
    if (!old) throw new Error("Missing first claim");
    await db.notificationDelivery.update({ where: { id: base.id }, data: { updatedAt: stale } });
    await recoverStalledEmailDeliveries(db, 50);
    const newer = await claimEmailAttempt(db, { deliveryId: base.id, provider: "RESEND_EMAIL", operationId: "new" });
    if (!newer) throw new Error("Missing second claim");
    expect(newer.claimAt).toEqual(old.claimAt);
    const late = await finishEmailAttempt(db, old, { accepted: true, providerMessageReference: "late" });
    expect(late.applied).toBe(false); expect(late.delivery.status).toBe("SENDING");
  });
});
