/* eslint-disable @typescript-eslint/no-explicit-any -- focused service fixtures model deferred Prisma delegates. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/promoters/production-readiness", () => ({ assertPromotersProductionReady: vi.fn() }));

import { PromoterLifecycleService } from "@/lib/promoters/lifecycle.service";
import { PromoterAttributionService } from "@/lib/promoters/promoter-attribution.service";
import {
  bindPromoterAttribution,
  confirmPromoterQualification,
  observePromoterQualificationEvidence,
  releasePromoterEarning,
  reversePromoterEarning,
} from "@/lib/promoters/qualification-earning.service";
import { evaluatePromoterAttributionRisk, evaluatePromoterQualificationRisk, evaluatePromoterReleaseRisk } from "@/lib/promoters/promoter-fraud.service";
import {
  derivePromoterReconciliationFindings,
  rescanPromoterReconciliationCase,
  retryPromoterAccrual,
} from "@/lib/promoters/promoter-reconciliation.service";

const operationId = "phase25.operation.001";
const txDb = (overrides: Record<string, unknown> = {}) => {
  const db: any = {
    $transaction: async (fn: (tx: any) => unknown) => fn(db),
    promoterEventIntent: { create: vi.fn().mockResolvedValue({}) },
    promoterAccount: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({ id: "account", publicReference: "PRA-ACCOUNT", status: "ACTIVE" }) },
    promoterProgram: { findUnique: vi.fn(), update: vi.fn() },
    promoterProgramVersion: { findUnique: vi.fn(), update: vi.fn() },
    promoterEnrollment: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    promoterReferralCode: { findFirst: vi.fn(), update: vi.fn() },
    promoterTouch: { findUnique: vi.fn(), create: vi.fn() },
    promoterAttribution: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    promoterQualification: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    promoterEarning: { findUnique: vi.fn(), update: vi.fn() },
    promoterFraudCase: { create: vi.fn() },
    promoterReconciliationCase: { findUnique: vi.fn(), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    store: { findUnique: vi.fn().mockResolvedValue(null) },
    ...overrides,
  };
  return db;
};

describe("Phase 25 canonical promoter lifecycle services", () => {
  beforeEach(() => vi.clearAllMocks());

  it("replays the same application and rejects a changed request", async () => {
    const db = txDb({ promoterAccount: { findUnique: vi.fn().mockResolvedValue({ operationId, requestHash: "hash-a" }) } });
    const service = new PromoterLifecycleService(db);
    await expect(service.submitPromoterApplication({ userId: "u", legalName: "A Promoter", operationId, requestHash: "hash-a" })).resolves.toMatchObject({ operationId });
    await expect(service.submitPromoterApplication({ userId: "u", legalName: "Changed", operationId, requestHash: "hash-b" })).rejects.toMatchObject({ code: "PROMOTER_INVALID_COMMAND" });
  });
  it("reviews an application without activating it", async () => {
    const account = { id: "a", publicReference: "PRA-A", status: "APPLIED" };
    const db = txDb({ promoterAccount: { findUnique: vi.fn().mockResolvedValue(account), update: vi.fn().mockResolvedValue({ ...account, status: "APPROVED" }) } });
    const result = await new PromoterLifecycleService(db).reviewPromoterApplication({ promoterAccountId: "a", operationId, approved: true });
    expect(result.status).toBe("APPROVED");
    expect(db.promoterAccount.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) }));
  });
  it("requires agreement and compliance before activation", async () => {
    const db = txDb({ promoterAccount: { findUnique: vi.fn().mockResolvedValue({ id: "a", status: "APPROVED", identityStatus: "PENDING", taxProfileStatus: "PENDING", payoutReadinessStatus: "PENDING", agreementStatus: "PENDING", fraudCases: [] }) } });
    await expect(new PromoterLifecycleService(db).activatePromoterAccount({ promoterAccountId: "a", operationId })).rejects.toMatchObject({ code: "PROMOTER_NOT_ELIGIBLE" });
  });
  it("rejects invalid account lifecycle transitions", async () => {
    const db = txDb({ promoterAccount: { findUnique: vi.fn().mockResolvedValue({ id: "a", status: "TERMINATED" }), update: vi.fn() } });
    await expect(new PromoterLifecycleService(db).requestPromoterAccountChanges({ promoterAccountId: "a", operationId })).rejects.toMatchObject({ code: "PROMOTER_INVALID_COMMAND" });
    expect(db.promoterAccount.update).not.toHaveBeenCalled();
  });
  it("does not mutate approved commercial terms", async () => {
    const db = txDb({
      promoterProgram: { findUnique: vi.fn().mockResolvedValue({ id: "p", status: "ACTIVE" }), update: vi.fn() },
      promoterProgramVersion: { findUnique: vi.fn().mockResolvedValue({ id: "v", programId: "p", status: "ACTIVE" }), update: vi.fn() },
    });
    await expect(new PromoterLifecycleService(db).updatePromoterProgramDraft({ programId: "p", programVersionId: "v", targetType: "CUSTOMER", code: "CODE", name: "Program", versionTerms: {} as any, operationId })).rejects.toMatchObject({ code: "PROMOTER_NOT_ELIGIBLE" });
    expect(db.promoterProgram.update).not.toHaveBeenCalled();
  });
  it("rejects program transitions that skip submission or use a foreign version", async () => {
    const db = txDb({
      promoterProgram: { findUnique: vi.fn().mockResolvedValue({ id: "p", status: "DRAFT", targetType: "CUSTOMER" }), update: vi.fn() },
      promoterProgramVersion: { findUnique: vi.fn().mockResolvedValue({ id: "v", programId: "p", status: "DRAFT" }), update: vi.fn() },
    });
    await expect(new PromoterLifecycleService(db).endPromoterProgram({ programId: "p", programVersionId: "v", operationId })).rejects.toMatchObject({ code: "PROMOTER_NOT_ELIGIBLE" });
    await expect(new PromoterLifecycleService(db).approvePromoterProgram({ programId: "p", programVersionId: "v", approvedByUserId: "admin", createdByUserId: "creator", operationId: "phase25.operation.002" })).rejects.toMatchObject({ code: "PROMOTER_NOT_ELIGIBLE" });
    db.promoterProgram.findUnique.mockResolvedValue({ id: "p", status: "UNDER_REVIEW", targetType: "CUSTOMER" });
    db.promoterProgramVersion.findUnique.mockResolvedValue({ id: "v", programId: "other", status: "DRAFT" });
    await expect(new PromoterLifecycleService(db).approvePromoterProgram({ programId: "p", programVersionId: "v", approvedByUserId: "admin", createdByUserId: "creator", operationId: "phase25.operation.003" })).rejects.toMatchObject({ code: "PROMOTER_NOT_ELIGIBLE" });
    expect(db.promoterProgram.update).not.toHaveBeenCalled();
  });
  it("rejects duplicate active enrolment and inactive accounts/programs", async () => {
    const db = txDb({
      promoterAccount: { findUnique: vi.fn().mockResolvedValue({ id: "a", status: "ACTIVE" }) },
      promoterProgramVersion: { findUnique: vi.fn().mockResolvedValue({ id: "v", status: "ACTIVE" }) },
      promoterEnrollment: { findUnique: vi.fn().mockResolvedValue({ id: "e", status: "ACTIVE" }), create: vi.fn() },
    });
    await expect(new PromoterLifecycleService(db).enrollPromoterInProgram({ promoterAccountId: "a", programVersionId: "v", operationId })).rejects.toMatchObject({ code: "PROMOTER_INVALID_COMMAND" });
    db.promoterAccount.findUnique.mockResolvedValue({ id: "a", status: "SUSPENDED" });
    await expect(new PromoterLifecycleService(db).enrollPromoterInProgram({ promoterAccountId: "a", programVersionId: "v", operationId: "phase25.operation.002" })).rejects.toMatchObject({ code: "PROMOTER_NOT_ELIGIBLE" });
  });
  it("uses HMAC-backed code lookup and preserves safe touch evidence", async () => {
    process.env.PROMOTER_REFERRAL_HMAC_SECRET = "phase25-test-secret-which-is-at-least-32-bytes";
    const db = txDb({
      promoterReferralCode: { findFirst: vi.fn().mockResolvedValue({ id: "c", enrollmentId: "e", programVersionId: "v", promoterAccountId: "a", enrollment: { publicReference: "PEN-E", status: "ACTIVE", programVersionId: "v", programVersion: { publicReference: "PPV-V", status: "ACTIVE" } }, promoterAccount: { status: "ACTIVE" }, maskedDisplay: "ABC…345" }) },
      promoterTouch: { findUnique: vi.fn(), create: vi.fn().mockResolvedValue({ publicReference: "PTC-TOUCH" }) },
    });
    const service = new PromoterLifecycleService(db);
    const touch = await service.recordPromoterTouch({ operationId, programVersionId: "v", code: "ABCD2345", destinationType: "CUSTOMER_REGISTRATION" });
    expect(touch.publicReference).toBe("PTC-TOUCH");
    expect(db.promoterReferralCode.findFirst.mock.calls[0][0].where.codeHmac).toHaveLength(64);
    expect(db.promoterTouch.create.mock.calls[0][0].data.safeEvidence).toEqual({ code: "ABC…345" });
  });
  it("replays a touch only for the same request hash", async () => {
    const replay = { publicReference: "PTC-REPLAY", operationId, requestHash: "hash-a" };
    const db = txDb({ promoterTouch: { findUnique: vi.fn().mockResolvedValue(replay), create: vi.fn() } });
    const service = new PromoterLifecycleService(db);
    await expect(service.recordPromoterTouch({ operationId, requestHash: "hash-a", programVersionId: "v", destinationType: "CUSTOMER_REGISTRATION" })).resolves.toBe(replay);
    await expect(service.recordPromoterTouch({ operationId, requestHash: "hash-b", programVersionId: "v", destinationType: "CUSTOMER_REGISTRATION" })).rejects.toMatchObject({ code: "PROMOTER_INVALID_COMMAND" });
    expect(db.promoterTouch.create).not.toHaveBeenCalled();
  });
});

describe("Phase 25 attribution and qualification services", () => {
  it("preserves first valid touch and rejects later overwrite", async () => {
    const db = txDb({ promoterAttribution: { findUnique: vi.fn().mockResolvedValue({ operationId: "other", requestHash: "other" }), create: vi.fn() }, promoterTouch: { findUnique: vi.fn().mockResolvedValue({ validityStatus: "VALID", promoterAccount: { status: "ACTIVE" }, enrollment: { status: "ACTIVE" }, programVersionId: "v" }) } });
    const service = new PromoterAttributionService(db);
    await expect(service.bind({ promoterAccountId: "a", enrollmentId: "e", programVersionId: "v", touchId: "t", subjectType: "CUSTOMER", customerUserId: "customer:new", subjectKey: "customer:new", expiresAt: new Date(), operationId, requestHash: "hash" })).rejects.toMatchObject({ code: "PROMOTER_ATTRIBUTION_CONFLICT" });
  });
  it("rejects attribution after registration or for an existing subject", async () => {
    const db = txDb({
      promoterAttribution: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      promoterTouch: {
        findUnique: vi.fn().mockResolvedValue({
          validityStatus: "VALID",
          occurredAt: new Date(2_000),
          promoterAccount: { status: "ACTIVE" },
          enrollment: { status: "ACTIVE" },
          programVersionId: "v",
          programVersion: { status: "ACTIVE", program: { targetType: "CUSTOMER" } },
        }),
      },
    });
    await expect(bindPromoterAttribution(db, { touchId: "t", programVersionId: "v", subjectType: "CUSTOMER", customerUserId: "c", subjectKey: "c", subjectCreatedAt: new Date(1_000), expiresAt: new Date(), operationId, requestHash: "hash" })).rejects.toMatchObject({ code: "PROMOTER_NOT_ELIGIBLE" });
  });
  it("rejects non-settled, incomplete, refunded, chargeback, and fraud evidence", async () => {
    const db = txDb();
    for (const evidence of [{ paymentSucceeded: false, fulfilmentCompleted: true }, { paymentSucceeded: true, paymentSettled: false, fulfilmentCompleted: true }, { paymentSucceeded: true, fulfilmentCompleted: false }, { paymentSucceeded: true, paymentSettled: true, fulfilmentCompleted: true, fullyRefunded: true }, { paymentSucceeded: true, paymentSettled: true, fulfilmentCompleted: true, chargeback: true }, { paymentSucceeded: true, paymentSettled: true, fulfilmentCompleted: true, confirmedFraud: true }]) {
      await expect(observePromoterQualificationEvidence(db, { ...evidence, subjectType: "CUSTOMER", qualifyingEventType: "CUSTOMER_FIRST_COMPLETED_SETTLED_COURIER_ORDER", operationId, evidence: {}, evidenceFingerprint: "e" })).rejects.toMatchObject({ code: "PROMOTER_NOT_ELIGIBLE" });
    }
  });
  it("requires a completed settled canonical event and makes hold state explicit", async () => {
    const attribution = { id: "a", status: "ATTRIBUTED", subjectType: "CUSTOMER", programVersionId: "v", programVersion: { qualifyingEventType: "CUSTOMER_FIRST_COMPLETED_SETTLED_COURIER_ORDER", qualificationHoldDays: 7 } };
    const db = txDb({ promoterAttribution: { findUnique: vi.fn().mockResolvedValue(attribution) }, promoterQualification: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "q", status: "EVIDENCE_OBSERVED" }) } });
    const result = await observePromoterQualificationEvidence(db, { attributionId: "a", subjectType: "CUSTOMER", qualifyingEventType: attribution.programVersion.qualifyingEventType, paymentSucceeded: true, paymentSettled: true, fulfilmentCompleted: true, evidence: { settled: true }, evidenceFingerprint: "e", operationId });
    expect(result.status).toBe("EVIDENCE_OBSERVED");
    expect(db.promoterQualification.create).toHaveBeenCalled();
  });
  it("does not release a qualification before hold expiry", async () => {
    const db = txDb({ promoterQualification: { findUnique: vi.fn().mockResolvedValue({ id: "q", status: "EVIDENCE_OBSERVED", programVersion: { qualificationHoldDays: 7 } }), update: vi.fn().mockImplementation(async ({ data }: any) => ({ id: "q", status: data.status, holdUntil: data.holdUntil })) } });
    const result = await confirmPromoterQualification(db, { qualificationId: "q", operationId });
    expect(result.status).toBe("QUALIFIED_HELD");
    expect(result.holdUntil.getTime()).toBeGreaterThan(Date.now());
  });
  it("does not release held earnings with unresolved fraud, compliance, or reconciliation", async () => {
    const base = { id: "e", status: "ACCRUED_HELD", holdUntil: new Date(0), qualification: { status: "RELEASABLE", attribution: { status: "ATTRIBUTED" } }, promoterAccount: { identityStatus: "VERIFIED", taxProfileStatus: "READY", payoutReadinessStatus: "READY", fraudCases: [] } };
    for (const earning of [{ ...base, promoterAccount: { ...base.promoterAccount, fraudCases: [{ status: "OPEN" }] } }, { ...base, promoterAccount: { ...base.promoterAccount, identityStatus: "PENDING" } }]) {
      const db = txDb({ promoterEarning: { findUnique: vi.fn().mockResolvedValue(earning), update: vi.fn() } });
      await expect(releasePromoterEarning(db, { earningId: "e", operationId })).rejects.toMatchObject({ code: "PROMOTER_NOT_ELIGIBLE" });
    }
    const db = txDb({ promoterEarning: { findUnique: vi.fn().mockResolvedValue(base), update: vi.fn() }, promoterReconciliationCase: { findFirst: vi.fn().mockResolvedValue({ id: "rc", status: "OPEN" }) } });
    await expect(releasePromoterEarning(db, { earningId: "e", operationId })).rejects.toMatchObject({ code: "PROMOTER_NOT_ELIGIBLE" });
  });
  it("keeps reversal bounded and preserves original earning evidence", async () => {
    const db = txDb({ promoterEarning: { findUnique: vi.fn().mockResolvedValue({ id: "e", status: "PAYABLE", reversedAmount: 80, grossAmount: 100, qualificationId: "q" }), update: vi.fn() } });
    await expect(reversePromoterEarning(db, { earningId: "e", amount: 30, operationId, commissionOperationId: operationId, frozenCommissionAllocation: {} })).rejects.toMatchObject({ code: "PROMOTER_NOT_ELIGIBLE" });
    expect(db.promoterEarning.update).not.toHaveBeenCalled();
    await expect(reversePromoterEarning(db, { earningId: "e", amount: 0, operationId: "phase25.operation.002", commissionOperationId: operationId, frozenCommissionAllocation: {} })).rejects.toMatchObject({ code: "PROMOTER_INVALID_COMMAND" });
  });
  it("creates a bounded reconciliation case instead of rewriting withdrawn history", async () => {
    const earning = { id: "e", status: "WITHDRAWN", reversedAmount: 0, grossAmount: 100, qualificationId: "q", publicReference: "PER-E", promoterAccountId: "a" };
    const db = txDb({ promoterEarning: { findUnique: vi.fn().mockResolvedValue(earning), update: vi.fn().mockResolvedValue({ ...earning, status: "RECONCILIATION_REQUIRED" }) }, promoterReconciliationCase: { findFirst: vi.fn(), create: vi.fn().mockResolvedValue({ publicReference: "PRC-E" }) } });
    const result = await reversePromoterEarning(db, { earningId: "e", amount: 10, operationId, commissionOperationId: operationId, frozenCommissionAllocation: {} });
    expect(result).toMatchObject({ publicReference: "PRC-E" });
    expect(db.promoterReconciliationCase.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reason: "WITHDRAWAL_EVIDENCE_MISMATCH", earningId: "e" }) }));
    expect(db.promoterEarning.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "RECONCILIATION_REQUIRED" } }));
  });
});

describe("Phase 25 deterministic fraud and reconciliation", () => {
  it("returns deterministic reason-coded outcomes", () => {
    expect(evaluatePromoterAttributionRisk({ sameVerifiedEmail: true, now: new Date("2026-01-01") })).toMatchObject({ outcome: "BLOCK_ATTRIBUTION", reasonCode: "SELF_REFERRAL_IDENTITY_MATCH" });
    expect(evaluatePromoterQualificationRisk({ referralRing: true })).toMatchObject({ outcome: "BLOCK_RELEASE", reasonCode: "CONFIRMED_PATTERN_BLOCK" });
    expect(evaluatePromoterReleaseRisk({ samePayoutAccount: true })).toMatchObject({ outcome: "BLOCK_RELEASE", reasonCode: "PAYMENT_OR_CONTROL_CONFLICT" });
  });
  it("derives reconciliation findings without opaque resolution", () => {
    const findings = derivePromoterReconciliationFindings({ touchValid: true, duplicateAttribution: true, walletLedgerMismatch: true, reversalMissing: true });
    expect(findings.map((finding) => finding.reason)).toEqual(["DUPLICATE_ATTRIBUTION", "REVERSAL_MISSING", "WALLET_LEDGER_MISMATCH"]);
    expect(findings.every((finding) => finding.safeEvidence.canonicalComparison === true)).toBe(true);
  });
  it("resolves only after canonical convergence and retries through a callback", async () => {
    const db = txDb({ promoterReconciliationCase: { findUnique: vi.fn().mockResolvedValue({ id: "r", reason: "DUPLICATE_ATTRIBUTION" }), update: vi.fn().mockResolvedValue({ status: "RESOLVED" }) } });
    await expect(rescanPromoterReconciliationCase(db, { reference: "PRC-R", comparison: {} })).resolves.toMatchObject({ status: "RESOLVED" });
    const callback = vi.fn().mockResolvedValue("retried");
    const retryDb = txDb({ promoterReconciliationCase: { findUnique: vi.fn().mockResolvedValue({ publicReference: "PRC-R" }) } });
    await expect(retryPromoterAccrual(retryDb, { reference: "PRC-R", operationId, recover: callback })).resolves.toBe("retried");
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ operationId: `accrual:${operationId}` }));
  });
});
