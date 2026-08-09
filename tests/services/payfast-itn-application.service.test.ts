import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VerifiedPayfastItn } from "@/lib/services/payfast-itn-verification.service";
import { fixedAttempt } from "../payments/payfast/payfast-itn-test-fixtures";

const db = vi.hoisted(() => ({
  eventFindUnique: vi.fn(),
  eventCreate: vi.fn(),
  eventUpdate: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    paymentWebhookEvent: { findUnique: db.eventFindUnique, create: db.eventCreate, update: db.eventUpdate },
    $transaction: db.transaction,
  },
}));
import { applyVerifiedPayfastItn } from "@/lib/services/payfast-itn-application.service";

const source = readFileSync("lib/services/payfast-itn-application.service.ts", "utf8");
const ledgerSource = readFileSync("lib/services/ledger-posting.service.ts", "utf8");
const at = new Date("2026-07-17T12:00:00.000Z");
const event = {
  id: "event-id", publicReference: "pwe_abcdefghijklmnopqrstuvwx", provider: "PAYFAST", environment: "SANDBOX",
  eventFingerprint: "a".repeat(64), merchantReference: fixedAttempt.merchantReference, providerPaymentId: "123456",
  providerStatus: "COMPLETE", normalizedStatus: "COMPLETE", processingStatus: "VERIFIED", paymentId: fixedAttempt.paymentId,
  attemptId: fixedAttempt.id, ledgerJournalId: null, credentialVersion: fixedAttempt.providerCredentialVersion, sourceAddress: "196.1.2.3",
  sourceAddressVerified: true, signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true,
  safePayloadSnapshot: { amountGross: "123.45" }, unknownFieldCount: 0, rejectionCode: null, reconciliationReason: null,
  receivedAt: at, verifiedAt: at, appliedAt: null, createdAt: at, updatedAt: at,
};
const verified: VerifiedPayfastItn = Object.freeze({
  kind: "VERIFIED",
  receipt: Object.freeze({ fingerprint: event.eventFingerprint, environment: "SANDBOX", merchantReference: fixedAttempt.merchantReference, providerPaymentId: "123456", providerStatus: "COMPLETE", normalizedStatus: "COMPLETE", sourceAddress: "196.1.2.3", credentialVersion: fixedAttempt.providerCredentialVersion, paymentId: fixedAttempt.paymentId, attemptId: fixedAttempt.id, safePayloadSnapshot: Object.freeze({ merchantReference: fixedAttempt.merchantReference, providerPaymentId: "123456", providerStatus: "COMPLETE", amountGross: "123.45", amountFee: null, amountNet: null, itemReference: null, fieldCount: 6, unknownFieldCount: 0, protocolVersion: "payfast-itn-v1" }), unknownFieldCount: 0, sourceAddressVerified: true, signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true }),
  fields: Object.freeze({ merchantReference: fixedAttempt.merchantReference, providerPaymentId: "123456", providerStatus: "COMPLETE", amountGross: "123.45", merchantId: "10000100", signature: "a".repeat(32), amountFee: null, amountNet: null, recurringTokenFingerprint: null, itemReference: null, unknownFieldCount: 0, safePayloadSnapshot: event.safePayloadSnapshot }),
  attempt: fixedAttempt,
  verifiedAt: at,
});

function transactionDouble() {
  const payment = {
    ...fixedAttempt.payment,
    subjectType: "COURIER_ORDER" as const,
    orderId: "order-id",
    marketplaceCheckoutId: null,
    subscriptionInvoiceId: null,
    userId: "payer-id",
  };
  const account = (id: string, code: string, purpose: "CASH_CLEARING" | "HELD", category: "ASSET" | "LIABILITY") => ({
    id, code, purpose, category, currency: "ZAR", status: "ACTIVE", allowNegative: false,
    currentBalance: new Prisma.Decimal("0"), debitTotal: new Prisma.Decimal("0"), creditTotal: new Prisma.Decimal("0"), version: 0,
    wallet: { id: "platform-wallet", ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
  });
  const accounts = [account("account-cash", "PLATFORM-CASH-CLEARING-ZAR", "CASH_CLEARING", "ASSET"), account("account-held", "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", "HELD", "LIABILITY")];
  const journal = {
    id: "journal-id", reference: "LJ-TEST", type: "EXTERNAL_PAYMENT_RECEIPT", currency: "ZAR", idempotencyKey: "payfast:payment:pay_abcdefghijklmnop:complete:v1",
    requestHash: "b".repeat(64), sourceReference: "PAYFAST:PAYMENT:PAY_ABCDEFGHIJKLMNOP:COMPLETE", correlationId: fixedAttempt.payment.publicReference,
    memo: "receipt", metadata: {}, policyVersion: "phase9-v1", totalDebits: new Prisma.Decimal("123.45"), totalCredits: new Prisma.Decimal("123.45"),
    reversalOfJournalId: null, createdByUserId: null, postedAt: at, createdAt: at, originalJournal: null, reversalJournal: null,
    entries: [
      { id: "entry-cash", sequence: 1, journalId: "journal-id", accountId: "account-cash", direction: "DEBIT", amount: new Prisma.Decimal("123.45"), lineCode: "PAYFAST_CASH_RECEIVED", memo: null, createdAt: at, account: { id: "account-cash", code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET" } },
      { id: "entry-held", sequence: 2, journalId: "journal-id", accountId: "account-held", direction: "CREDIT", amount: new Prisma.Decimal("123.45"), lineCode: "CUSTOMER_FUNDS_HELD", memo: null, createdAt: at, account: { id: "account-held", code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY" } },
    ],
  };
  const tx = {
    $queryRaw: vi.fn()
      .mockResolvedValueOnce([{ id: "event-id" }])
      .mockResolvedValueOnce([{ id: "payment-id" }])
      .mockResolvedValueOnce([{ id: "attempt-id" }])
      .mockResolvedValue([{ id: "account-cash" }, { id: "account-held" }]),
    paymentWebhookEvent: { findUnique: vi.fn().mockResolvedValue(event), update: vi.fn().mockResolvedValue(event) },
    payment: { findUnique: vi.fn().mockResolvedValue(payment), update: vi.fn().mockResolvedValue({}) },
    paymentAttempt: { findUnique: vi.fn().mockResolvedValue({ ...fixedAttempt, provider: "PAYFAST", providerConfirmedAt: null }), findFirst: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue({}) },
    order: { findUnique: vi.fn().mockResolvedValue({ orderNumber: "ORD-TEST-1" }) },
    paymentVerifiedEventIntent: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ publicReference: "pve_abcdefghijklmnopqrstuvwx" }) },
    notificationEventIntent: { upsert: vi.fn().mockResolvedValue({}) },
    ledgerAccount: { findMany: vi.fn().mockResolvedValue(accounts), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    ledgerJournal: { findUnique: vi.fn().mockImplementation(({ where }) => Promise.resolve(where.idempotencyKey ? null : journal)), create: vi.fn().mockResolvedValue({ id: journal.id }) },
    ledgerEntry: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    paymentStatusHistory: { create: vi.fn().mockResolvedValue({}), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    paymentReconciliationCase: { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.eventFindUnique.mockResolvedValue(null);
  db.eventCreate.mockResolvedValue(event);
});

describe("Payfast ITN application service transaction contract", () => {
  it("executes the complete success transaction double and shared ledger primitive", async () => {
    const tx = transactionDouble();
    db.transaction.mockImplementation(async (operation) => operation(tx));
    await expect(applyVerifiedPayfastItn(verified)).resolves.toMatchObject({ outcome: "APPLIED", ledgerJournalReference: "LJ-TEST" });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(4);
    expect(tx.ledgerJournal.create).toHaveBeenCalledTimes(1);
    expect(tx.ledgerEntry.createMany).toHaveBeenCalledTimes(1);
    expect(tx.ledgerAccount.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.paymentAttempt.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SUCCEEDED" }) }));
    expect(tx.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SUCCEEDED", successWebhookEventId: event.id, successLedgerJournalId: "journal-id" }) }));
    expect(tx.paymentStatusHistory.create).toHaveBeenCalledTimes(1);
    expect(tx.paymentReconciliationCase.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.paymentWebhookEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ processingStatus: "APPLIED" }) }));
    expect(tx.paymentVerifiedEventIntent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "PAYMENT_SUCCEEDED_VERIFIED", paymentId: "payment-id", webhookEventId: event.id }) }));
    expect(tx.notificationEventIntent.upsert).toHaveBeenCalledOnce();
  });

  it("retries a serializable conflict before applying exactly once", async () => {
    const tx = transactionDouble();
    db.transaction.mockRejectedValueOnce(Object.assign(new Error("could not serialize access"), { code: "P2034" })).mockImplementation(async (operation) => operation(tx));
    await expect(applyVerifiedPayfastItn(verified)).resolves.toMatchObject({ outcome: "APPLIED" });
    expect(db.transaction).toHaveBeenCalledTimes(2);
    expect(tx.ledgerJournal.create).toHaveBeenCalledTimes(1);
  });

  it("converges on an existing verified receipt without rewriting its evidence", async () => {
    const tx = transactionDouble();
    db.eventFindUnique.mockResolvedValue(event);
    db.transaction.mockImplementation(async (operation) => operation(tx));
    await expect(applyVerifiedPayfastItn(verified)).resolves.toMatchObject({ outcome: "APPLIED" });
    expect(db.eventUpdate).not.toHaveBeenCalled();
    expect(db.eventCreate).not.toHaveBeenCalled();
  });

  it("locks event, payment, attempt, then delegates sorted account locks in one Serializable transaction", () => {
    const eventLock = source.indexOf('FROM "PaymentWebhookEvent"');
    const paymentLock = source.indexOf('FROM "Payment"');
    const attemptLock = source.indexOf('FROM "PaymentAttempt"');
    const ledger = source.indexOf("postLedgerJournalWithinTransaction", attemptLock);
    expect(eventLock).toBeGreaterThan(0); expect(paymentLock).toBeGreaterThan(eventLock); expect(attemptLock).toBeGreaterThan(paymentLock); expect(ledger).toBeGreaterThan(attemptLock);
    expect(source).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(ledgerSource).toMatch(/ORDER BY "id" ASC FOR UPDATE/);
  });
  it("covers duplicate, stale, failure, unknown, rollback, and reconciliation branches without cross-domain mutation", () => {
    expect(source).toContain('alreadySame ? "DUPLICATE"'); expect(source).toContain('processingStatus: "IGNORED_STALE"');
    expect(source).toContain("PROVIDER_REFERENCE_CONFLICT"); expect(source).toContain("APPLICATION_FAILURE_AFTER_VERIFICATION");
    expect(source).toContain('normalizedStatus === "UNKNOWN"'); expect(source).toContain('attemptStatus === "FAILED"');
    expect(source).toContain('["CANCELLED", "EXPIRED"]');
    expect(source).not.toMatch(/\bfetch\s*\(/); expect(source).not.toMatch(/\b(?:tx\.)?order\.(?:create|update|updateMany|delete|upsert)/);
  });
});
