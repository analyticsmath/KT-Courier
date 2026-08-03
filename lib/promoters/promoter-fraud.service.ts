/* eslint-disable @typescript-eslint/no-explicit-any -- delegates are generated during Phase 26.5 validation. */
import { randomUUID } from "node:crypto";
import { PromoterError } from "./errors";
import { assertPromotersProductionReady } from "./production-readiness";
import { invalidatePromoterQualification, reversePromoterEarning } from "./qualification-earning.service";

type Db = any;
export type PromoterRiskOutcome = "PASS" | "REVIEW" | "BLOCK_ATTRIBUTION" | "BLOCK_QUALIFICATION" | "BLOCK_RELEASE";
export type PromoterRiskDecision = Readonly<{ outcome: PromoterRiskOutcome; reasonCode?: string; safeEvidence: Readonly<Record<string, string | number | boolean>>; policyVersion: string; evaluatedAt: Date }>;
type RiskInput = Record<string, unknown> & { policyVersion?: string; now?: Date };
const ref = () => `PFC-${randomUUID().replaceAll("-", "").toUpperCase()}`;

function decision(outcome: PromoterRiskOutcome, reasonCode: string | undefined, safeEvidence: Record<string, string | number | boolean>, input: RiskInput): PromoterRiskDecision {
  return Object.freeze({ outcome, reasonCode, safeEvidence: Object.freeze(safeEvidence), policyVersion: input.policyVersion ?? "phase25-v1", evaluatedAt: input.now ?? new Date() });
}

/** Deterministic rules only; callers never receive identities, documents, payment references, devices, or IPs. */
export function evaluatePromoterAttributionRisk(input: RiskInput): PromoterRiskDecision {
  if (input.sameUserIdentity || input.sameVerifiedEmail || input.sameVerifiedPhone || input.sameIdentityDocumentFingerprint || input.promoterOwnedStore || input.promoterControlledCustomerAccount) return decision("BLOCK_ATTRIBUTION", "SELF_REFERRAL_IDENTITY_MATCH", { identityMatch: true }, input);
  if (input.samePayoutAccount || input.sameVerifiedPaymentInstrument) return decision("BLOCK_ATTRIBUTION", "SELF_REFERRAL_FINANCIAL_MATCH", { financialMatch: true }, input);
  if (input.codeStuffing || input.attributionHijacking) return decision("BLOCK_ATTRIBUTION", "ATTRIBUTION_ABUSE", { attributionAbuse: true }, input);
  if (input.referralRing || input.rapidSyntheticRegistrations || input.internalEmployeeAbuse) return decision("REVIEW", "ATTRIBUTION_PATTERN_REVIEW", { pattern: true }, input);
  if (input.repeatedDeviceRiskFingerprint || input.repeatedNetworkRiskFingerprint) return decision("REVIEW", "REPEATED_RISK_FINGERPRINT", { repeatedRiskFingerprint: true }, input);
  return decision("PASS", undefined, {}, input);
}

export function evaluatePromoterQualificationRisk(input: RiskInput): PromoterRiskDecision {
  if (input.cancelledOrderFarming || input.refundFarming || input.chargebackFarming) return decision("BLOCK_QUALIFICATION", "REVERSAL_FARMING", { reversalPattern: true }, input);
  if (input.manufacturedLowValueTransactions) return decision("BLOCK_QUALIFICATION", "SYNTHETIC_TRANSACTION", { syntheticValuePattern: true }, input);
  if (input.referralRing || input.internalEmployeeAbuse) return decision("BLOCK_RELEASE", "CONFIRMED_PATTERN_BLOCK", { pattern: true }, input);
  if (input.repeatedDeviceRiskFingerprint || input.repeatedNetworkRiskFingerprint || input.rapidSyntheticRegistrations) return decision("REVIEW", "QUALIFICATION_PATTERN_REVIEW", { pattern: true }, input);
  return decision("PASS", undefined, {}, input);
}
/** Release rules cover readiness and post-qualification evidence only; they never use opaque scoring. */
export function evaluatePromoterReleaseRisk(input: RiskInput): PromoterRiskDecision {
  if (input.samePayoutAccount || input.sameVerifiedPaymentInstrument || input.promoterControlledCustomerAccount) return decision("BLOCK_RELEASE", "PAYMENT_OR_CONTROL_CONFLICT", { financialOrControlMatch: true }, input);
  if (input.cancelledOrderFarming || input.refundFarming || input.chargebackFarming || input.manufacturedLowValueTransactions) return decision("BLOCK_RELEASE", "POST_QUALIFICATION_ABUSE", { postQualificationAbuse: true }, input);
  if (input.repeatedDeviceRiskFingerprint || input.repeatedNetworkRiskFingerprint || input.referralRing || input.rapidSyntheticRegistrations) return decision("REVIEW", "RELEASE_PATTERN_REVIEW", { pattern: true }, input);
  if (input.identityReady === false || input.taxReady === false || input.payoutReady === false || input.agreementAccepted === false) return decision("BLOCK_RELEASE", "COMPLIANCE_NOT_READY", { readiness: false }, input);
  return decision("PASS", undefined, {}, input);
}

async function event(tx: Db, eventType: string, aggregateReference: string, operationId: string, safePayload: object) { return tx.promoterEventIntent.create({ data: { eventType, aggregateReference, operationId, safePayload } }); }

export async function openPromoterFraudCase(db: Db, input: any) {
  assertPromotersProductionReady();
  if (!input.decision || input.decision.outcome === "PASS" || !input.operationId) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A non-pass deterministic decision and operation ID are required.");
  return db.$transaction(async (tx: Db) => {
    const existing = await tx.promoterFraudCase.findFirst({ where: { promoterAccountId: input.promoterAccountId ?? null, attributionId: input.attributionId ?? null, qualificationId: input.qualificationId ?? null, reason: input.reason ?? "OTHER", status: { in: ["OPEN", "UNDER_REVIEW", "ACTION_REQUIRED"] } } });
    if (existing) return existing;
    const row = await tx.promoterFraudCase.create({ data: { publicReference: ref(), promoterAccountId: input.promoterAccountId ?? null, attributionId: input.attributionId ?? null, qualificationId: input.qualificationId ?? null, earningId: input.earningId ?? null, subjectType: input.subjectType, subjectReference: input.subjectReference ?? null, reason: input.reason ?? "OTHER", status: input.decision.outcome === "REVIEW" ? "OPEN" : "ACTION_REQUIRED", priority: input.priority ?? "HIGH", safeSummary: input.decision.reasonCode ?? "Deterministic promoter risk requires review.", safeEvidence: { ...input.decision.safeEvidence, policyVersion: input.decision.policyVersion, evaluatedAt: input.decision.evaluatedAt.toISOString() } } });
    await event(tx, "PROMOTER_FRAUD_REVIEW_REQUIRED", row.publicReference, input.operationId, { outcome: input.decision.outcome, reasonCode: input.decision.reasonCode });
    return row;
  });
}

export async function reviewPromoterFraudCase(db: Db, input: any) { assertPromotersProductionReady(); return db.promoterFraudCase.update({ where: { publicReference: input.reference }, data: { status: "UNDER_REVIEW", lastObservedAt: new Date() } }); }
export const startPromoterFraudReview = reviewPromoterFraudCase;
export async function requestPromoterFraudEvidence(db: Db, input: any) {
  assertPromotersProductionReady();
  if (!input.operationId || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(input.operationId)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A stable operation ID is required.");
  return db.$transaction(async (tx: Db) => {
    const row = await tx.promoterFraudCase.findUnique({ where: { publicReference: input.reference } });
    if (!row || !["OPEN", "UNDER_REVIEW", "ACTION_REQUIRED"].includes(row.status)) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Evidence can only be requested for an open fraud case.");
    const updated = await tx.promoterFraudCase.update({ where: { id: row.id }, data: { status: "ACTION_REQUIRED", lastObservedAt: new Date(), resolutionCode: "EVIDENCE_REQUESTED" } });
    await event(tx, "PROMOTER_FRAUD_REVIEW_REQUIRED", updated.publicReference, input.operationId, { action: "EVIDENCE_REQUESTED", reasonCode: input.reasonCode ?? "EVIDENCE_REQUIRED" });
    return updated;
  });
}
export async function clearPromoterFraudCase(db: Db, input: any) { assertPromotersProductionReady(); return db.$transaction(async (tx: Db) => { const row = await tx.promoterFraudCase.findUnique({ where: { publicReference: input.reference } }); if (!row || !input.evidenceSupportsClearance) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Clearance requires supporting evidence."); return tx.promoterFraudCase.update({ where: { id: row.id }, data: { status: "CLEARED", resolvedAt: new Date(), resolutionCode: "EVIDENCE_CLEARED" } }); }); }
export async function confirmPromoterFraud(db: Db, input: any) {
  assertPromotersProductionReady();
  return db.$transaction(async (tx: Db) => {
    const row = await tx.promoterFraudCase.findUnique({ where: { publicReference: input.reference } });
    if (!row) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Fraud case not found.");
    const confirmed = await tx.promoterFraudCase.update({ where: { id: row.id }, data: { status: "CONFIRMED", resolvedAt: new Date(), resolutionCode: input.reasonCode ?? "CONFIRMED_FRAUD" } });
    if (row.attributionId) await tx.promoterAttribution.update({ where: { id: row.attributionId }, data: { status: "INVALIDATED", invalidatedAt: new Date() } });
    if (row.qualificationId) await invalidatePromoterQualification(tx, { qualificationId: row.qualificationId, operationId: `fraud:qualification:${input.operationId}` });
    if (row.earningId && input.reversal) await reversePromoterEarning(tx, { ...input.reversal, earningId: row.earningId, operationId: `fraud:reversal:${input.operationId}` });
    await event(tx, "PROMOTER_EARNING_REVERSED", confirmed.publicReference, input.operationId, { reasonCode: confirmed.resolutionCode });
    return confirmed;
  });
}
export async function rescanPromoterFraudCase(db: Db, input: any) {
  assertPromotersProductionReady();
  if (!input.decision || !input.operationId) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A deterministic decision and stable operation ID are required.");
  const row = await db.promoterFraudCase.findUnique({ where: { publicReference: input.reference } });
  if (!row) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Fraud case not found.");
  if (input.decision.outcome === "PASS") return clearPromoterFraudCase(db, { reference: input.reference, evidenceSupportsClearance: true, operationId: input.operationId });
  return db.promoterFraudCase.update({ where: { id: row.id }, data: { status: input.decision.outcome === "REVIEW" ? "UNDER_REVIEW" : "ACTION_REQUIRED", lastObservedAt: new Date(), safeEvidence: { ...input.decision.safeEvidence, policyVersion: input.decision.policyVersion, reasonCode: input.decision.reasonCode } } });
}
