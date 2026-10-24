import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { parseEvidenceUtcInput } from "@/lib/production-readiness/evidence-time";
import { acceptanceStorageKey, parseAcceptanceRecord, assertSandboxPaymentAcceptance, AcceptanceEvidenceSchema, evidenceIsCurrent, type AcceptanceRecord } from "@/lib/production-readiness/evidence";
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
  const sandbox = { kind: "SANDBOX" as const, key: "payment_integration_acceptance" as const, releaseSha, observedAt: evidence.observedAt, expiresAt: evidence.expiresAt, evidenceReference: "admin:verified-sandbox-payment", reason: "Provider-hosted test payment and ledger confirmation reviewed", genuineOperatorAcceptance: true as const, provider: "PAYSTACK" as const, paymentReference: "pay_verified_test123", amount: "148.35", currency: "ZAR" as const };
  const payment: NonNullable<Parameters<typeof assertSandboxPaymentAcceptance>[0]> = { provider: "PAYSTACK", status: "SUCCEEDED", amount: new Prisma.Decimal("148.35"), currency: "ZAR", successLedgerJournalId: "journal1", providerConfirmedAt: now, reconciliationStatus: "CLEAR", successfulAttempt: { provider: "PAYSTACK", status: "SUCCEEDED", providerEnvironment: "SANDBOX", amount: new Prisma.Decimal("148.35"), currency: "ZAR", providerReference: "provider-reference", providerConfirmedAt: now } };
  it("accepts a real provider-hosted test transaction without requiring a real charge or financial authorization", () => {
    expect(AcceptanceEvidenceSchema.safeParse(sandbox).success).toBe(true);
    expect(() => assertSandboxPaymentAcceptance(payment, sandbox)).not.toThrow();
    expect(() => assertSandboxPaymentAcceptance({ ...payment, reconciliationStatus: "RESOLVED" }, sandbox)).not.toThrow();
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

it("preserves the legacy sandbox draft's mode, author and version without asserting live-money acceptance", () => {
  const legacy = { evidence: { kind: "SANDBOX", key: "live_paid_order_acceptance", releaseSha, observedAt: evidence.observedAt, expiresAt: evidence.expiresAt, evidenceReference: "admin:verified-sandbox-payment", reason: "Verified provider-hosted sandbox receipt", genuineOperatorAcceptance: true, provider: "PAYSTACK", paymentReference: "pay_verified_test123", amount: "148.35", currency: "ZAR" }, version: 1, status: "DRAFT", authorId: "author", approverId: null, approvedAt: null };
  const record = parseAcceptanceRecord(legacy);
  expect(record).toMatchObject({ evidence: { kind: "SANDBOX", key: "payment_integration_acceptance" }, version: 1, status: "DRAFT", authorId: "author", approverId: null });
  expect(evidenceIsCurrent(record, releaseSha, now)).toBe(false);
  expect(acceptanceStorageKey(record.evidence.key)).toBe("production_acceptance_live_paid_order_acceptance");
  expect(AcceptanceEvidenceSchema.safeParse(legacy.evidence).success).toBe(false);
});
it("parses explicit UTC observations consistently and rejects rollover or ambiguous date input", () => {
  expect(parseEvidenceUtcInput("2026-10-24T19:02")).toBe("2026-10-24T19:02:00.000Z");
  expect(parseEvidenceUtcInput("2026-10-24T19:02:15")).toBe("2026-10-24T19:02:15.000Z");
  for (const value of ["2026-02-30T12:00", "2026-10-24T25:00", "2026-10-24T19:02+05:00", "invalid"]) expect(() => parseEvidenceUtcInput(value)).toThrow(/valid UTC/);
});
