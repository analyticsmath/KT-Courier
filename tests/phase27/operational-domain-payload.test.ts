import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { resolveRequiredDomainPayload } from "@/lib/notifications/required-domain-payload";
import { currentRequiredSourceRecipient } from "@/lib/notifications/current-source-recipient";

const asDb = (db: unknown) => db as Prisma.TransactionClient;
function fixture(type: "STORE" | "DRIVER") {
  const withdrawal = { id: "withdrawal", ownerType: type, ownerId: "owner", publicReference: "wd-public", wallet: { ownerType: type, ownerId: "owner" }, reserveLedgerJournalId: "reserve", requestedByUserId: "foreign-employee", status: "REQUESTED", payoutLedgerJournalId: null, completedAt: null };
  const history = { withdrawalId: "withdrawal", fromStatus: null, toStatus: "REQUESTED", reasonCode: "WITHDRAWAL_REQUESTED" };
  const db = { withdrawalRequest: { findUnique: vi.fn().mockResolvedValue(withdrawal) }, withdrawalStatusHistory: { findUnique: vi.fn().mockResolvedValue(history) }, store: { findUnique: vi.fn().mockResolvedValue({ ownerUserId: "current-user", status: "ACTIVE" }) }, driverProfile: { findUnique: vi.fn().mockResolvedValue({ userId: "current-user", status: "ACTIVE", active: true }) }, user: { findUnique: vi.fn().mockResolvedValue({ role: type, status: "ACTIVE" }) } };
  const intent = { sourceAuthority: "WITHDRAWAL", eventType: `${type}_WITHDRAWAL_STATUS_CHANGED`, aggregateReference: "withdrawal", operationId: "withdrawal-status-notification:history", safePayload: { sourceEventId: "history", customerUserId: "attacker", bankAccount: "spoofed" } };
  return { db, intent, withdrawal, history };
}
describe("canonical operational notification recipients", () => {
  it.each(["STORE", "DRIVER"] as const)("uses current %s ownership, excludes employee/bank/browser facts", async type => {
    const { db, intent } = fixture(type); const payload = await resolveRequiredDomainPayload(asDb(db), intent);
    expect(payload).toEqual({ [type === "STORE" ? "storeOwnerUserId" : "driverUserId"]: "current-user", reference: "wd-public", status: "requested" });
    expect(JSON.stringify(payload)).not.toMatch(/foreign-employee|attacker|bankAccount|spoofed/);
  });
  it.each(["STORE", "DRIVER"] as const)("rejects foreign wallet/history, duplicate reservation and false paid evidence for %s", async type => {
    for (const mutate of [
      f => { f.withdrawal.wallet.ownerId = "foreign"; }, f => { f.history.withdrawalId = "foreign"; },
      f => { f.history.reasonCode = "FUNDS_RESERVED"; }, f => { f.history.toStatus = "PAID"; },
      f => { f.intent.operationId = "forged"; }, f => { f.withdrawal.reserveLedgerJournalId = ""; },
      f => { f.db.user.findUnique.mockResolvedValue({ role: "CUSTOMER", status: "ACTIVE" }); },
      f => { f.db.driverProfile.findUnique.mockResolvedValue({ userId: "current-user", status: "SUSPENDED", active: false }); f.db.store.findUnique.mockResolvedValue({ ownerUserId: "current-user", status: "DISABLED" }); },
    ] as Array<(value: ReturnType<typeof fixture>) => void>) {
      const value = fixture(type); mutate(value);
      await expect(resolveRequiredDomainPayload(asDb(value.db), value.intent)).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
    }
  });
  it("rechecks the source owner before queued delivery instead of retaining a stale recipient", async () => {
    const { db, intent } = fixture("STORE");
    const checked = { ...db, notificationSourceReceipt: { findUnique: vi.fn().mockResolvedValue({ sourceAuthority: "WITHDRAWAL", sourceEventType: intent.eventType, sourceEventId: intent.operationId, aggregateReference: intent.aggregateReference }) }, notificationEventIntent: { findUnique: vi.fn().mockResolvedValue(intent) } };
    expect(await currentRequiredSourceRecipient(asDb(checked), "receipt", "current-user")).toBe(true);
    expect(await currentRequiredSourceRecipient(asDb(checked), "receipt", "old-owner")).toBe(false);
    db.store.findUnique.mockResolvedValue({ ownerUserId: "new-owner", status: "ACTIVE" });
    expect(await currentRequiredSourceRecipient(asDb(checked), "receipt", "current-user")).toBe(false);
  });
  it("binds assignment histories to both driver and order, never an injected driver ID", async () => {
    const base = fixture("DRIVER");
    const db = { ...base.db, orderAssignment: { findUnique: vi.fn().mockResolvedValue({ orderId: "order", driverProfileId: "owner", order: { orderNumber: "order-public" } }) }, orderAssignmentEvent: { findUnique: vi.fn().mockResolvedValue({ assignmentId: "assignment", orderId: "order", driverProfileId: "owner", newStatus: "ASSIGNED" }) } };
    const intent = { sourceAuthority: "DISPATCH", eventType: "DRIVER_ASSIGNMENT_STATUS_CHANGED", aggregateReference: "assignment", operationId: "driver-assignment-notification:history", safePayload: { sourceEventId: "history", driverUserId: "attacker" } };
    expect(await resolveRequiredDomainPayload(asDb(db), intent)).toEqual({ driverUserId: "current-user", reference: "order-public", status: "assigned" });
    db.orderAssignmentEvent.findUnique.mockResolvedValue({ assignmentId: "assignment", orderId: "order", driverProfileId: "foreign", newStatus: "ASSIGNED" });
    await expect(resolveRequiredDomainPayload(asDb(db), intent)).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
  });
  it.each(["STORE", "DRIVER"] as const)("earning release requires matching owner/wallet/history and ledger evidence for %s", async type => {
    const base = fixture(type); const earning = { id: "earning", publicReference: "earning-public", storeId: "owner", driverId: "owner", wallet: { ownerType: type, ownerId: "owner" }, accrualLedgerJournalId: "accrual", releaseLedgerJournalId: null, releasedAt: null };
    const history = { storeEarningId: "earning", driverEarningId: "earning", fromStatus: "ACCRUED", toStatus: "RELEASED" };
    const db = { ...base.db, storeEarning: { findUnique: vi.fn().mockResolvedValue(earning) }, driverEarning: { findUnique: vi.fn().mockResolvedValue(earning) }, storeEarningStatusHistory: { findUnique: vi.fn().mockResolvedValue(history) }, driverEarningStatusHistory: { findUnique: vi.fn().mockResolvedValue(history) } };
    const intent = { sourceAuthority: `${type}_EARNINGS`, eventType: `${type}_EARNING_STATUS_CHANGED`, aggregateReference: "earning", operationId: `${type.toLowerCase()}-earning-notification:history`, safePayload: { sourceEventId: "history" } };
    await expect(resolveRequiredDomainPayload(asDb(db), intent)).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
    const verified = { ...earning, releaseLedgerJournalId: "release", releasedAt: new Date() }; db.storeEarning.findUnique.mockResolvedValue(verified); db.driverEarning.findUnique.mockResolvedValue(verified);
    expect(await resolveRequiredDomainPayload(asDb(db), intent)).toMatchObject({ reference: "earning-public", status: "released" });
  });
});
