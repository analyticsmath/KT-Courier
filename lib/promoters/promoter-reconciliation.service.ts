/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 25 delegates are source-locked pending generated client validation. */
import { createHash, randomUUID } from "node:crypto";
import { PromoterError } from "./errors";
import { assertPromotersProductionReady } from "./production-readiness";

type Db = any;
export const PROMOTER_RECONCILIATION_REASONS = ["ATTRIBUTION_WITHOUT_VALID_TOUCH", "DUPLICATE_ATTRIBUTION", "ATTRIBUTION_SUBJECT_MISMATCH", "ATTRIBUTION_AFTER_SUBJECT_CREATION", "QUALIFICATION_WITHOUT_ATTRIBUTION", "DUPLICATE_QUALIFICATION", "QUALIFYING_EVENT_MISMATCH", "QUALIFICATION_AFTER_REFUND", "COMMISSION_ACCRUAL_MISSING", "DUPLICATE_COMMISSION_ACCRUAL", "EARNING_AMOUNT_MISMATCH", "RELEASE_BEFORE_HOLD_END", "PAYABLE_WITHOUT_COMPLIANCE", "REVERSAL_MISSING", "WALLET_LEDGER_MISMATCH", "WITHDRAWAL_EVIDENCE_MISMATCH", "SELF_REFERRAL_SUSPECTED", "REFERRAL_RING_SUSPECTED", "APPLICATION_FAILURE"] as const;
export type PromoterReconciliationReason = typeof PROMOTER_RECONCILIATION_REASONS[number];
const ref = () => `PRC-${randomUUID().replaceAll("-", "").toUpperCase()}`;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Converts canonical comparisons to safe, deterministic cases. No case is manually resolved. */
export function derivePromoterReconciliationFindings(input: Record<string, any>): ReadonlyArray<Readonly<{ reason: PromoterReconciliationReason; priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; safeSummary: string; safeEvidence: Record<string, boolean | number | string> }>> {
  const items: Array<any> = [];
  const add = (condition: boolean, reason: PromoterReconciliationReason, priority: any, safeSummary: string) => { if (condition) items.push(Object.freeze({ reason, priority, safeSummary, safeEvidence: Object.freeze({ canonicalComparison: true }) })); };
  add(!input.touchValid, "ATTRIBUTION_WITHOUT_VALID_TOUCH", "HIGH", "Attribution lacks a valid acquisition touch.");
  add(Boolean(input.duplicateAttribution), "DUPLICATE_ATTRIBUTION", "HIGH", "More than one attribution targets the acquisition subject.");
  add(Boolean(input.subjectMismatch), "ATTRIBUTION_SUBJECT_MISMATCH", "HIGH", "Attribution subject does not match its program target.");
  add(Boolean(input.attributionAfterSubjectCreation), "ATTRIBUTION_AFTER_SUBJECT_CREATION", "HIGH", "Attribution was observed after subject creation.");
  add(Boolean(input.qualificationWithoutAttribution), "QUALIFICATION_WITHOUT_ATTRIBUTION", "HIGH", "Qualification lacks a valid attribution.");
  add(Boolean(input.duplicateQualification), "DUPLICATE_QUALIFICATION", "HIGH", "Duplicate qualification evidence was observed.");
  add(Boolean(input.qualifyingEventMismatch), "QUALIFYING_EVENT_MISMATCH", "HIGH", "Qualification event differs from program evidence requirements.");
  add(Boolean(input.qualificationAfterRefund), "QUALIFICATION_AFTER_REFUND", "HIGH", "Qualification has refunded or reversed payment evidence.");
  add(Boolean(input.commissionAccrualMissing), "COMMISSION_ACCRUAL_MISSING", "HIGH", "Qualified conversion lacks canonical commission accrual.");
  add(Boolean(input.duplicateCommissionAccrual), "DUPLICATE_COMMISSION_ACCRUAL", "CRITICAL", "More than one commission accrual is linked to the earning.");
  add(Boolean(input.earningAmountMismatch), "EARNING_AMOUNT_MISMATCH", "HIGH", "Earning differs from canonical commission evidence.");
  add(Boolean(input.releaseBeforeHoldEnd), "RELEASE_BEFORE_HOLD_END", "CRITICAL", "Earning became payable before its hold ended.");
  add(Boolean(input.payableWithoutCompliance), "PAYABLE_WITHOUT_COMPLIANCE", "CRITICAL", "Payable earning lacks required compliance readiness.");
  add(Boolean(input.reversalMissing), "REVERSAL_MISSING", "CRITICAL", "Invalidated evidence lacks canonical reversal.");
  add(Boolean(input.walletLedgerMismatch), "WALLET_LEDGER_MISMATCH", "CRITICAL", "Wallet projection differs from ledger evidence.");
  add(Boolean(input.withdrawalEvidenceMismatch), "WITHDRAWAL_EVIDENCE_MISMATCH", "CRITICAL", "Withdrawal evidence does not converge with earning evidence.");
  add(Boolean(input.selfReferralSuspected), "SELF_REFERRAL_SUSPECTED", "HIGH", "Deterministic self-referral evidence requires review.");
  add(Boolean(input.referralRingSuspected), "REFERRAL_RING_SUSPECTED", "HIGH", "Deterministic referral-ring evidence requires review.");
  add(Boolean(input.applicationFailure), "APPLICATION_FAILURE", "MEDIUM", "A canonical operation did not converge.");
  return Object.freeze(items);
}

export async function scanPromoterReconciliation(db: Db, input: any) {
  assertPromotersProductionReady();
  const findings = derivePromoterReconciliationFindings(input.comparison ?? {});
  return db.$transaction(async (tx: Db) => Promise.all(findings.map(async (finding) => {
    const existing = await tx.promoterReconciliationCase.findFirst({ where: { reason: finding.reason, attributionId: input.attributionId ?? null, qualificationId: input.qualificationId ?? null, earningId: input.earningId ?? null, status: { in: ["OPEN", "MONITORING"] } } });
    if (existing) return tx.promoterReconciliationCase.update({ where: { id: existing.id }, data: { lastObservedAt: new Date(), safeEvidence: finding.safeEvidence } });
    const row = await tx.promoterReconciliationCase.create({ data: { publicReference: ref(), promoterAccountId: input.promoterAccountId ?? null, programVersionId: input.programVersionId ?? null, touchId: input.touchId ?? null, attributionId: input.attributionId ?? null, qualificationId: input.qualificationId ?? null, earningId: input.earningId ?? null, commissionAccrualId: input.commissionAccrualId ?? null, walletId: input.walletId ?? null, withdrawalId: input.withdrawalId ?? null, reason: finding.reason, priority: finding.priority, safeSummary: finding.safeSummary, safeEvidence: finding.safeEvidence } });
    await tx.promoterEventIntent.create({ data: { eventType: "PROMOTER_RECONCILIATION_REQUIRED", aggregateReference: row.publicReference, operationId: `reconciliation:${input.operationId}:${finding.reason}`, safePayload: { reason: finding.reason } } });
    return row;
  })));
}

/** A case resolves only when a new canonical scan reports no remaining finding. */
export async function rescanPromoterReconciliationCase(db: Db, input: any) {
  assertPromotersProductionReady();
  const caseRow = await db.promoterReconciliationCase.findUnique({ where: { publicReference: input.reference } });
  if (!caseRow) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Reconciliation case not found.");
  const findings = derivePromoterReconciliationFindings(input.comparison ?? {});
  const remains = findings.some((item) => item.reason === caseRow.reason);
  return db.promoterReconciliationCase.update({ where: { id: caseRow.id }, data: remains ? { status: "OPEN", lastObservedAt: new Date() } : { status: "RESOLVED", resolvedAt: new Date(), resolutionCode: "CANONICAL_EVIDENCE_CONVERGED" } });
}

async function retry(db: Db, input: any, kind: string) {
  assertPromotersProductionReady();
  if (!input.recover || !input.operationId) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Canonical recovery callback and operation ID are required.");
  const caseRow = await db.promoterReconciliationCase.findUnique({ where: { publicReference: input.reference } });
  if (!caseRow) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Reconciliation case not found.");
  const result = await input.recover({ caseRow, operationId: `${kind}:${input.operationId}` });
  await db.promoterEventIntent.create({ data: { eventType: "PROMOTER_RECONCILIATION_REQUIRED", aggregateReference: caseRow.publicReference, operationId: `retry:${kind}:${input.operationId}`, safePayload: { recovery: kind, requestHash: hash({ kind, reference: input.reference }) } } });
  return result;
}
export const retryPromoterAttribution = (db: Db, input: any) => retry(db, input, "attribution");
export const retryPromoterQualification = (db: Db, input: any) => retry(db, input, "qualification");
export const retryPromoterAccrual = (db: Db, input: any) => retry(db, input, "accrual");
export const retryPromoterRelease = (db: Db, input: any) => retry(db, input, "release");
export const retryPromoterReversal = (db: Db, input: any) => retry(db, input, "reversal");
