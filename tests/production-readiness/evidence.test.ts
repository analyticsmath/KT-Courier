import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { assertSandboxPaymentAcceptance, AcceptanceEvidenceSchema, evidenceIsCurrent, type AcceptanceRecord } from "@/lib/production-readiness/evidence";
const now = new Date("2026-10-07T00:00:00Z");
const releaseSha = "a".repeat(40);
const evidence = { kind: "CI" as const, key: "current_ci_certification" as const, releaseSha, observedAt: "2026-10-06T23:00:00Z", expiresAt: "2026-10-07T01:00:00Z", evidenceReference: "disposable:successful-ci", reason: "Disposable certification evidence", runUrl: "https://github.com/analyticsmath/KT-Courier/actions/runs/1", conclusion: "SUCCESS" as const, skippedCriticalTests: 0 as const, testsPassed: 10 };
const approved: AcceptanceRecord = { evidence, version: 2, status: "APPROVED", authorId: "author", approverId: "reviewer", approvedAt: "2026-10-06T23:30:00Z" };
describe("release evidence cannot substitute fixtures, stale releases or self-review for genuine acceptance", () => {
  it("requires successful repo-bound CI with zero critical skips", () => {
    expect(AcceptanceEvidenceSchema.safeParse(evidence).success).toBe(true);
    for (const patch of [{ conclusion: "FAILURE" }, { skippedCriticalTests: 1 }, { testsPassed: 0 }, { runUrl: "https://example.com/green" }]) expect(AcceptanceEvidenceSchema.safeParse({ ...evidence, ...patch }).success).toBe(false);
  });
  it("rejects absent, draft, revoked, self-reviewed, expired and different-SHA evidence", () => {
    expect(evidenceIsCurrent(approved, releaseSha, now)).toBe(true);
    expect(evidenceIsCurrent(undefined, releaseSha, now)).toBe(false);
    for (const patch of [{ status: "DRAFT" as const }, { status: "REVOKED" as const }, { approverId: "author" }, { approvedAt: null }]) expect(evidenceIsCurrent({ ...approved, ...patch }, releaseSha, now)).toBe(false);
    expect(evidenceIsCurrent(approved, "b".repeat(40), now)).toBe(false);
    expect(evidenceIsCurrent(approved, undefined, now)).toBe(false);
    expect(evidenceIsCurrent(approved, releaseSha, new Date("2026-10-07T02:00:00Z"))).toBe(false);
  });
  it("requires separate financial authorization references for real-money acceptance", () => {
    const live = { kind: "LIVE", key: "refund_acceptance", releaseSha, observedAt: evidence.observedAt, expiresAt: evidence.expiresAt, evidenceReference: evidence.evidenceReference, reason: evidence.reason, genuineOperatorAcceptance: true, financialAuthorizationReference: null };
    expect(AcceptanceEvidenceSchema.safeParse(live).success).toBe(false);
    expect(AcceptanceEvidenceSchema.safeParse({ ...live, financialAuthorizationReference: "operator:authorization-1" }).success).toBe(true);
    expect(AcceptanceEvidenceSchema.safeParse({ ...live, key: "current_ci_certification" }).success).toBe(false);
  });
});

describe("verified provider sandbox payment integration acceptance", () => {
  const sandbox = { kind: "SANDBOX" as const, key: "live_paid_order_acceptance" as const, releaseSha, observedAt: evidence.observedAt, expiresAt: evidence.expiresAt, evidenceReference: "admin:verified-sandbox-payment", reason: "Provider-hosted test payment and ledger confirmation reviewed", genuineOperatorAcceptance: true as const, provider: "PAYSTACK" as const, paymentReference: "pay_verified_test123", amount: "148.35", currency: "ZAR" as const };
  const payment: NonNullable<Parameters<typeof assertSandboxPaymentAcceptance>[0]> = { provider: "PAYSTACK", status: "SUCCEEDED", amount: new Prisma.Decimal("148.35"), currency: "ZAR", successLedgerJournalId: "journal1", providerConfirmedAt: now, reconciliationStatus: "CLEAR", successfulAttempt: { provider: "PAYSTACK", status: "SUCCEEDED", providerEnvironment: "SANDBOX", amount: new Prisma.Decimal("148.35"), currency: "ZAR", providerReference: "provider-reference", providerConfirmedAt: now } };
  it("accepts a real provider-hosted test transaction without requiring a real charge or financial authorization", () => {
    expect(AcceptanceEvidenceSchema.safeParse(sandbox).success).toBe(true);
    expect(() => assertSandboxPaymentAcceptance(payment, sandbox)).not.toThrow();
  });
  it("does not let a payment receipt certify refunds, payouts or unrelated acceptance", () => {
    for (const key of ["refund_acceptance", "payout_acceptance", "settlement_acceptance", "driver_gps_acceptance"]) expect(AcceptanceEvidenceSchema.safeParse({ ...sandbox, key }).success).toBe(false);
    for (const amount of ["0.00", "-1.00", "148.351", "NaN", "invalid", "9".repeat(100) + ".00"]) expect(AcceptanceEvidenceSchema.safeParse({ ...sandbox, amount }).success).toBe(false);
  });
  it("rejects absent, unverified, mismatched or unreconciled canonical receipts", () => {
    const invalid = [null, { ...payment, status: "REQUIRES_ACTION" as const }, { ...payment, provider: "PAYFAST" as const }, { ...payment, amount: new Prisma.Decimal("148.34") }, { ...payment, successLedgerJournalId: null }, { ...payment, providerConfirmedAt: null }, { ...payment, reconciliationStatus: "REQUIRED" as const }, { ...payment, successfulAttempt: null }, { ...payment, successfulAttempt: { ...payment.successfulAttempt!, providerEnvironment: "PRODUCTION" as const } }, { ...payment, successfulAttempt: { ...payment.successfulAttempt!, amount: new Prisma.Decimal("205.85") } }, { ...payment, successfulAttempt: { ...payment.successfulAttempt!, providerReference: null } }];
    for (const candidate of invalid) expect(() => assertSandboxPaymentAcceptance(candidate, sandbox)).toThrow(/verified Paystack sandbox/);
  });
});
