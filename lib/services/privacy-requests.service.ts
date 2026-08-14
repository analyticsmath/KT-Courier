import { db } from "@/lib/db";
import { MARKETING_CHANNELS, setMarketingPreference } from "@/lib/privacy/preference.service";
import { evaluateRetentionHolds, type HoldEvaluationResult } from "@/lib/retention/hold-evaluator";
import { phase5Reference, phase5Repository, safeOperationalText } from "@/lib/operations/phase5-repository";
import { recordAdminActivity } from "./admin-activity.service";

export const PRIVACY_REQUEST_TYPES = ["ACCESS", "CORRECTION", "DELETION_OR_ANONYMISATION", "OBJECTION", "CONSENT_WITHDRAWAL", "PORTABILITY"] as const;
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];
export const PRIVACY_REQUEST_STATUSES = ["SUBMITTED", "IDENTITY_VERIFICATION_REQUIRED", "UNDER_REVIEW", "APPROVED", "PARTIALLY_APPROVED", "REJECTED", "PROCESSING", "COMPLETED", "CANCELLED"] as const;
type PrivacyRequestStatus = (typeof PRIVACY_REQUEST_STATUSES)[number];

export class PrivacyRequestError extends Error { constructor(readonly code: string, message = code) { super(message); this.name = "PrivacyRequestError"; } }
type PrivacyRequestAuthorityRecord = Record<string, unknown> & {
  id: string;
  publicReference: string;
  requesterUserId: string | null;
  requestType: string;
  status: string;
  identityVerificationStatus: string;
  decision: string | null;
};
type PrivacyRequestAuthorityDetail = PrivacyRequestAuthorityRecord & {
  events: Record<string, unknown>[];
  executionPlan: Record<string, unknown> | null;
  holdEvaluationSummary: HoldEvaluationResult | null;
};

function readPrivacyRequestAuthority(record: Record<string, unknown>): PrivacyRequestAuthorityRecord {
  if (typeof record.id !== "string" || record.id.length === 0 || typeof record.publicReference !== "string" || record.publicReference.length === 0 || typeof record.requestType !== "string" || typeof record.status !== "string" || typeof record.identityVerificationStatus !== "string") {
    throw new PrivacyRequestError("PRIVACY_REQUEST_INVALID_PROJECTION");
  }
  if (record.requesterUserId !== null && typeof record.requesterUserId !== "string") {
    throw new PrivacyRequestError("PRIVACY_REQUEST_INVALID_PROJECTION");
  }
  if (record.decision !== null && record.decision !== undefined && typeof record.decision !== "string") {
    throw new PrivacyRequestError("PRIVACY_REQUEST_INVALID_PROJECTION");
  }

  return {
    ...record,
    id: record.id,
    publicReference: record.publicReference,
    requesterUserId: record.requesterUserId ?? null,
    requestType: record.requestType,
    status: record.status,
    identityVerificationStatus: record.identityVerificationStatus,
    decision: record.decision === undefined ? null : record.decision,
  };
}
const transitions: Record<PrivacyRequestStatus, readonly PrivacyRequestStatus[]> = {
  SUBMITTED: ["IDENTITY_VERIFICATION_REQUIRED", "UNDER_REVIEW", "CANCELLED"], IDENTITY_VERIFICATION_REQUIRED: ["UNDER_REVIEW", "REJECTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "PARTIALLY_APPROVED", "REJECTED"], APPROVED: ["PROCESSING"], PARTIALLY_APPROVED: ["PROCESSING"],
  REJECTED: [], PROCESSING: ["COMPLETED"], COMPLETED: [], CANCELLED: [],
};
const activeStatuses = ["SUBMITTED", "IDENTITY_VERIFICATION_REQUIRED", "UNDER_REVIEW", "APPROVED", "PARTIALLY_APPROVED", "PROCESSING", "RECEIVED", "VERIFIED", "IN_REVIEW", "FULFILMENT_IN_PROGRESS"];

function normalizedType(type: string): PrivacyRequestType { return type === "DELETION" ? "DELETION_OR_ANONYMISATION" : type as PrivacyRequestType; }
function needsVerification(type: PrivacyRequestType) { return type === "DELETION_OR_ANONYMISATION" || type === "ACCESS" || type === "PORTABILITY"; }
function deletionPlan(userId: string) {
  return { subjectReference: userId, generatedBy: "privacy-request-service", domains: [
    { dataClass: "ACCOUNT_PROFILE", action: "ANONYMIZE", reason: "CURRENT_ACCOUNT_IDENTITY" },
    { dataClass: "CUSTOMER_ADDRESS", action: "ANONYMIZE", reason: "CURRENT_CONTACT_DATA" },
    { dataClass: "MARKETING_PREFERENCE_HISTORY", action: "RETAIN", reason: "CONSENT_EVIDENCE" },
    { dataClass: "LEGAL_ACCEPTANCE_EVIDENCE", action: "RETAIN", reason: "LEGAL_EVIDENCE" },
    { dataClass: "PRIVATE_MEDIA", action: "MANUAL_REVIEW", reason: "POLICY_AND_HOLD_REQUIRED" },
    { dataClass: "CLAIM_EVIDENCE", action: "RETAIN", reason: "CLAIM_OR_DISPUTE_PRESERVATION" },
    { dataClass: "PAYMENT_METADATA", action: "PSEUDONYMIZE", reason: "FINANCIAL_INTEGRITY" },
    { dataClass: "FINANCIAL_LEDGER", action: "RETAIN", reason: "IMMUTABLE_ECONOMIC_RECORD" },
    { dataClass: "LOCATION_DATA", action: "DELETE", reason: "SUBJECT_TO_RETENTION_POLICY" },
  ] };
}
export function classifyCorrectionRequest(scope: string[]) {
  return scope.map((field) => ({ field, classification: ["name", "phone", "address", "profile"].includes(field) ? "MUTABLE_CURRENT_DATA" : ["order", "payment", "ledger", "refund"].includes(field) ? "IMMUTABLE_HISTORICAL_EVIDENCE" : ["customer_note", "delivery_note"].includes(field) ? "ADMINISTRATIVELY_CORRECTABLE_METADATA" : "UNSUPPORTED_LEGAL_REVIEW_REQUIRED" }));
}

export async function listPrivacyRequests() { return phase5Repository.privacyRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 }); }
export async function listOwnPrivacyRequests(userId: string) { return phase5Repository.privacyRequest.findMany({ where: { requesterUserId: userId }, orderBy: { createdAt: "desc" }, take: 100 }); }

async function getPrivacyRequestAuthority(publicReference: string, ownerUserId?: string): Promise<PrivacyRequestAuthorityDetail | null> {
  const rawRequest = await phase5Repository.privacyRequest.findUnique({ where: { publicReference } });
  if (!rawRequest) return null;
  const request = readPrivacyRequestAuthority(rawRequest);
  if (ownerUserId && request.requesterUserId !== ownerUserId) throw new PrivacyRequestError("PRIVACY_REQUEST_NOT_OWNER");
  const [events, plan] = await Promise.all([
    phase5Repository.privacyRequestEvent.findMany({ where: { privacyRequestId: String(request.id) }, orderBy: { createdAt: "asc" } }).catch(() => []),
    phase5Repository.privacyRequestExecutionPlan.findUnique({ where: { privacyRequestId: String(request.id) } }).catch(() => null),
  ]);
  const holdEvaluationSummary = request.requesterUserId ? await evaluateRetentionHolds({ subjectType: "User", subjectReference: String(request.requesterUserId) }) : null;
  return { ...request, events, executionPlan: plan, holdEvaluationSummary };
}

export async function getPrivacyRequest(publicReference: string, ownerUserId?: string) {
  const request = await getPrivacyRequestAuthority(publicReference, ownerUserId);
  if (!request) return null;
  const { id: _id, ...publicRequest } = request;
  return publicRequest;
}

export async function createPrivacyRequest(input: { requesterUserId: string; requestType: PrivacyRequestType; scope?: string[]; requestContext?: Record<string, unknown>; operationId: string }) {
  const replay = await phase5Repository.privacyRequest.findUnique({ where: { operationId: input.operationId } });
  if (replay) return replay;
  const existing = await phase5Repository.privacyRequest.findFirst({ where: { requesterUserId: input.requesterUserId, requestType: input.requestType, status: { in: activeStatuses } } });
  if (existing) throw new PrivacyRequestError("PRIVACY_REQUEST_DUPLICATE", "An equivalent privacy request is already active.");
  const status = needsVerification(input.requestType) ? "IDENTITY_VERIFICATION_REQUIRED" : "SUBMITTED";
  const scope = (input.scope ?? []).slice(0, 20);
  const request = await phase5Repository.privacyRequest.create({ data: { publicReference: phase5Reference("DSAR"), requesterUserId: input.requesterUserId, requestType: input.requestType, scope, requestContext: input.requestType === "CORRECTION" ? { ...(input.requestContext ?? {}), correctionClassification: classifyCorrectionRequest(scope) } : input.requestContext ?? null, operationId: input.operationId, status, identityVerificationStatus: needsVerification(input.requestType) ? "REQUIRED" : "AUTHENTICATED" } });
  await phase5Repository.privacyRequestEvent.create({ data: { privacyRequestId: String(request.id), operationId: `${input.operationId}:SUBMITTED`, eventType: status, safeReasonCode: "SELF_SERVICE_SUBMISSION", actorUserId: input.requesterUserId } });
  if (input.requestType === "DELETION_OR_ANONYMISATION") await phase5Repository.privacyRequestExecutionPlan.create({ data: { privacyRequestId: String(request.id), policySnapshot: deletionPlan(input.requesterUserId) } });
  return request;
}

export async function cancelOwnPrivacyRequest(input: { userId: string; publicReference: string; operationId: string }) {
  const request = await getPrivacyRequestAuthority(input.publicReference, input.userId);
  if (!request) throw new PrivacyRequestError("PRIVACY_REQUEST_NOT_FOUND");
  if (!["SUBMITTED", "IDENTITY_VERIFICATION_REQUIRED", "UNDER_REVIEW", "RECEIVED"].includes(String(request.status))) throw new PrivacyRequestError("PRIVACY_REQUEST_INVALID_TRANSITION");
  return transitionPrivacyRequest({ actorUserId: input.userId, publicReference: input.publicReference, nextStatus: "CANCELLED", reasonCode: "REQUESTER_CANCELLED", operationId: input.operationId, requesterCancellation: true });
}

export async function transitionPrivacyRequest(input: { actorUserId: string; publicReference: string; nextStatus: PrivacyRequestStatus; reasonCode: string; identityVerified?: boolean; operationId: string; requesterCancellation?: boolean }) {
  const rawRequest = await phase5Repository.privacyRequest.findUnique({ where: { publicReference: input.publicReference } });
  if (!rawRequest) throw new PrivacyRequestError("PRIVACY_REQUEST_NOT_FOUND");
  const request = readPrivacyRequestAuthority(rawRequest);
  const current = String(request.status) === "RECEIVED" ? "SUBMITTED" : String(request.status) === "IN_REVIEW" ? "UNDER_REVIEW" : String(request.status) === "FULFILMENT_IN_PROGRESS" ? "PROCESSING" : String(request.status);
  if (!transitions[current as PrivacyRequestStatus]?.includes(input.nextStatus)) throw new PrivacyRequestError("PRIVACY_REQUEST_INVALID_TRANSITION");
  if (input.requesterCancellation && request.requesterUserId !== input.actorUserId) throw new PrivacyRequestError("PRIVACY_REQUEST_NOT_OWNER");
  if (["UNDER_REVIEW", "APPROVED", "PARTIALLY_APPROVED", "PROCESSING", "COMPLETED"].includes(input.nextStatus) && needsVerification(normalizedType(String(request.requestType))) && request.identityVerificationStatus !== "VERIFIED" && !input.identityVerified) throw new PrivacyRequestError("PRIVACY_IDENTITY_VERIFICATION_REQUIRED");
  const replay = await phase5Repository.privacyRequestEvent.findUnique({ where: { operationId: input.operationId } }); if (replay) return request;
  const decision = ["APPROVED", "PARTIALLY_APPROVED", "REJECTED"].includes(input.nextStatus) ? input.nextStatus : request.decision;
  const updated = await phase5Repository.privacyRequest.update({ where: { id: String(request.id) }, data: { status: input.nextStatus, ...(input.identityVerified ? { identityVerificationStatus: "VERIFIED" } : {}), ...(decision ? { decision, decisionReason: safeOperationalText(input.reasonCode, 160), reviewedAt: new Date() } : {}), ...(input.nextStatus === "COMPLETED" ? { completedAt: new Date(), safeOutcome: safeOperationalText(input.reasonCode, 160) } : {}) } });
  await phase5Repository.privacyRequestEvent.create({ data: { privacyRequestId: String(request.id), operationId: input.operationId, eventType: input.nextStatus, safeReasonCode: safeOperationalText(input.reasonCode, 80), actorUserId: input.actorUserId } });
  await recordAdminActivity({ actorUserId: input.actorUserId, action: "STATUS_CHANGE", entityType: "PrivacyRequest", entityId: String(request.id), message: "Updated controlled privacy request lifecycle", metadata: { nextStatus: input.nextStatus, reasonCode: safeOperationalText(input.reasonCode, 80) } });
  return updated;
}

export async function processConsentWithdrawal(input: { actorUserId: string; publicReference: string; operationId: string }) {
  const request = await getPrivacyRequestAuthority(input.publicReference); if (!request || request.requesterUserId !== input.actorUserId) throw new PrivacyRequestError("PRIVACY_REQUEST_NOT_OWNER");
  if (normalizedType(String(request.requestType)) !== "CONSENT_WITHDRAWAL") throw new PrivacyRequestError("PRIVACY_REQUEST_INVALID_TRANSITION");
  await Promise.all(MARKETING_CHANNELS.map((channel) => setMarketingPreference({ userId: input.actorUserId, channel, optedIn: false, source: "PRIVACY_REQUEST", operationId: `${input.operationId}:${channel}` })));
  await transitionPrivacyRequest({ actorUserId: input.actorUserId, publicReference: input.publicReference, nextStatus: "UNDER_REVIEW", reasonCode: "CANONICAL_CONSENT_WITHDRAWAL_REVIEW", operationId: `${input.operationId}:REVIEW` });
  await transitionPrivacyRequest({ actorUserId: input.actorUserId, publicReference: input.publicReference, nextStatus: "APPROVED", reasonCode: "CANONICAL_CONSENT_WITHDRAWAL_APPROVED", operationId: `${input.operationId}:APPROVED` });
  await transitionPrivacyRequest({ actorUserId: input.actorUserId, publicReference: input.publicReference, nextStatus: "PROCESSING", reasonCode: "CANONICAL_CONSENT_WITHDRAWAL_PROCESSING", operationId: `${input.operationId}:PROCESSING` });
  return transitionPrivacyRequest({ actorUserId: input.actorUserId, publicReference: input.publicReference, nextStatus: "COMPLETED", reasonCode: "CANONICAL_MARKETING_CONSENT_WITHDRAWN", operationId: `${input.operationId}:COMPLETED` });
}

export async function buildPrivacyExport(userId: string) {
  const client = db as any;
  const [user, addresses, orders, preferences, requests, legalAcceptances] = await Promise.all([client.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, phone: true, createdAt: true } }), client.address.findMany({ where: { userId }, select: { id: true, label: true, line1: true, city: true, postalCode: true } }), client.order.findMany({ where: { customerId: userId }, select: { id: true, orderNumber: true, status: true, createdAt: true } }), client.notificationConsentRecord.findMany({ where: { userId }, select: { channel: true, purpose: true, status: true, updatedAt: true } }), listOwnPrivacyRequests(userId), client.legalDocumentAcceptance.findMany({ where: { userId }, select: { acceptedAt: true, evidenceType: true, documentVersion: { select: { publicReference: true, documentType: true, version: true } } } })]);
  return { schemaVersion: "privacy-export-v1", generatedAt: new Date().toISOString(), profile: user, addresses, orders, preferences, privacyRequests: requests.map((item) => ({ publicReference: item.publicReference, requestType: item.requestType, status: item.status, createdAt: item.createdAt })), legalAcceptances };
}
