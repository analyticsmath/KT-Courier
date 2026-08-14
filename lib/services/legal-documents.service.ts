import crypto from "node:crypto";
import { recordAdminActivity } from "./admin-activity.service";
import { phase5Reference, phase5Repository, safeOperationalText } from "@/lib/operations/phase5-repository";

export const LEGAL_DOCUMENT_TYPES = { PRIVACY_NOTICE: "PRIVACY_NOTICE", TERMS_OF_SERVICE: "TERMS_OF_SERVICE", REFUND_POLICY: "REFUND_POLICY", SHIPPING_POLICY: "SHIPPING_POLICY" } as const;
type ManagedLegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[keyof typeof LEGAL_DOCUMENT_TYPES];

export class LegalDocumentError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "LegalDocumentError"; }
}

const hashContent = (content: string) => crypto.createHash("sha256").update(content).digest("hex");
const isManagedType = (type: string): type is ManagedLegalDocumentType => Object.values(LEGAL_DOCUMENT_TYPES).includes(type as ManagedLegalDocumentType);
const isEffective = (document: any, at: Date) => document.publicationStatus === "PUBLISHED" && document.effectiveAt && new Date(String(document.effectiveAt)) <= at;
const sortEffective = (documents: any[]) => documents.sort((a, b) => new Date(String(b.effectiveAt)).getTime() - new Date(String(a.effectiveAt)).getTime() || new Date(String(b.publishedAt ?? 0)).getTime() - new Date(String(a.publishedAt ?? 0)).getTime());

function safePublicDocument(document: any) {
  return { publicReference: document.publicReference, documentType: document.documentType, version: document.version, jurisdiction: document.jurisdiction, contentHash: document.contentHash, content: document.content ?? null, contentReference: document.contentReference ?? null, effectiveAt: document.effectiveAt, publishedAt: document.publishedAt };
}

export async function listLegalDocumentVersions(input: { documentType?: string; jurisdiction?: string } = {}) {
  return phase5Repository.legalDocumentVersion.findMany({ where: { ...(input.documentType ? { documentType: input.documentType } : {}), ...(input.jurisdiction ? { jurisdiction: input.jurisdiction } : {}) }, orderBy: { createdAt: "desc" }, take: 100 });
}

export async function getLegalDocumentVersion(publicReference: string) {
  const doc = await phase5Repository.legalDocumentVersion.findUnique({ where: { publicReference } });
  if (!doc) return null;
  const acceptances = await phase5Repository.legalDocumentAcceptance.findMany({ where: { documentVersionId: String(doc.id) }, take: 50 }).catch(() => []);
  return { ...doc, acceptancesCount: acceptances.length, recentAcceptances: acceptances };
}

export async function resolveEffectiveLegalDocument(documentType: ManagedLegalDocumentType, input: { jurisdiction?: string; at?: Date } = {}) {
  const at = input.at ?? new Date();
  const documents = await phase5Repository.legalDocumentVersion.findMany({ where: { documentType, ...(input.jurisdiction ? { jurisdiction: input.jurisdiction } : {}) }, take: 200 });
  return sortEffective(documents.filter((document: any) => isEffective(document, at)))[0] ?? null;
}

export async function createLegalDocumentDraft(input: { actorUserId: string; documentType: string; version: string; jurisdiction: string; contentHash?: string; content?: string | null; contentReference?: string | null; acceptancePolicy?: string; }) {
  const content = input.content?.trim() || null;
  const contentReference = input.contentReference?.trim() || null;
  if (isManagedType(input.documentType) && !content && !contentReference) throw new LegalDocumentError("LEGAL_DOCUMENT_CONTENT_REQUIRED", "Legal document content or a canonical content reference is required.");
  const contentHash = (input.contentHash ?? (content ? hashContent(content) : "")).toLowerCase();
  if (!/^[a-f0-9]{64}$/i.test(contentHash) || (content && hashContent(content) !== contentHash)) throw new LegalDocumentError("LEGAL_DOCUMENT_CONTENT_INVALID", "Legal document content hash is invalid.");
  const document = await phase5Repository.legalDocumentVersion.create({ data: { publicReference: phase5Reference("LEGAL"), documentType: safeOperationalText(input.documentType, 80), version: safeOperationalText(input.version, 80), jurisdiction: safeOperationalText(input.jurisdiction, 80), contentHash, content, contentReference, acceptancePolicy: input.acceptancePolicy ? safeOperationalText(input.acceptancePolicy, 160) : null } });
  await recordAdminActivity({ actorUserId: input.actorUserId, action: "CREATE", entityType: "LegalDocumentVersion", entityId: String(document.id), message: "Created legal document draft", metadata: { reference: String(document.publicReference), documentType: String(document.documentType), version: String(document.version) } });
  return document;
}

export async function publishLegalDocumentVersion(input: { actorUserId: string; publicReference: string; operationId: string; effectiveAt?: Date; }) {
  const document = await phase5Repository.legalDocumentVersion.findUnique({ where: { publicReference: input.publicReference } });
  if (!document) throw new LegalDocumentError("LEGAL_DOCUMENT_NOT_FOUND", "Legal document version was not found.");
  if (document.publicationStatus !== "DRAFT") {
    if (document.publicationOperationId === input.operationId) return document;
    throw new LegalDocumentError("LEGAL_DOCUMENT_IMMUTABLE", "Published legal document versions are immutable.");
  }
  const publishedAt = new Date();
  const update = await phase5Repository.legalDocumentVersion.update({ where: { id: document.id }, data: { publicationStatus: "PUBLISHED", publishedByUserId: input.actorUserId, publishedAt, effectiveAt: input.effectiveAt ?? publishedAt, publicationOperationId: input.operationId } });
  if (isManagedType(String(document.documentType)) && new Date(String(update.effectiveAt)) <= publishedAt) {
    const prior = await phase5Repository.legalDocumentVersion.findMany({ where: { documentType: document.documentType, jurisdiction: document.jurisdiction, publicationStatus: "PUBLISHED" } });
    await Promise.all(prior.filter((candidate: any) => String(candidate.id) !== String(document.id) && candidate.effectiveAt && new Date(String(candidate.effectiveAt)) <= publishedAt).map((candidate: any) => phase5Repository.legalDocumentVersion.update({ where: { id: candidate.id }, data: { publicationStatus: "SUPERSEDED", supersededById: document.id } })));
  }
  await recordAdminActivity({ actorUserId: input.actorUserId, action: "STATUS_CHANGE", entityType: "LegalDocumentVersion", entityId: String(document.id), message: "Published immutable legal document version", metadata: { operationId: input.operationId, documentType: String(document.documentType), contentHash: crypto.createHash("sha256").update(String(document.contentHash)).digest("hex").slice(0, 16) } });
  return update;
}

export async function retireLegalDocumentVersion(input: { actorUserId: string; publicReference: string; operationId: string }) {
  const document = await phase5Repository.legalDocumentVersion.findUnique({ where: { publicReference: input.publicReference } });
  if (!document) throw new LegalDocumentError("LEGAL_DOCUMENT_NOT_FOUND", "Legal document version was not found.");
  if (document.publicationStatus === "RETIRED") return document;
  if (document.publicationStatus !== "PUBLISHED") throw new LegalDocumentError("LEGAL_DOCUMENT_TRANSITION_FORBIDDEN", "Only a published legal document version may be retired.");
  const retired = await phase5Repository.legalDocumentVersion.update({ where: { id: document.id }, data: { publicationStatus: "RETIRED" } });
  await recordAdminActivity({ actorUserId: input.actorUserId, action: "STATUS_CHANGE", entityType: "LegalDocumentVersion", entityId: String(document.id), message: "Retired legal document version", metadata: { operationId: input.operationId, documentType: String(document.documentType), reference: String(document.publicReference) } });
  return retired;
}

async function resolveAcceptableDocument(documentType: ManagedLegalDocumentType, publicReference?: string, jurisdiction?: string) {
  const document = publicReference ? await phase5Repository.legalDocumentVersion.findUnique({ where: { publicReference } }) : await resolveEffectiveLegalDocument(documentType, { jurisdiction });
  if (!document || document.documentType !== documentType) throw new LegalDocumentError("LEGAL_DOCUMENT_NOT_FOUND", "Legal document version was not found.");
  if (!isEffective(document, new Date())) throw new LegalDocumentError("LEGAL_DOCUMENT_NOT_EFFECTIVE", "Legal document version is not currently effective.");
  return document;
}

async function recordTypedAcceptance(input: { userId: string; documentType: ManagedLegalDocumentType; evidenceType: "TERMS_ACCEPTANCE" | "PRIVACY_NOTICE_ACKNOWLEDGEMENT"; publicReference?: string; jurisdiction?: string; source: string; safeRequestEvidence?: Record<string, unknown> }) {
  const document = await resolveAcceptableDocument(input.documentType, input.publicReference, input.jurisdiction);
  const subjectReference = input.evidenceType;
  const acceptance = await phase5Repository.legalDocumentAcceptance.upsert({ where: { documentVersionId_userId_subjectReference: { documentVersionId: String(document.id), userId: input.userId, subjectReference } }, update: {}, create: { documentVersionId: String(document.id), userId: input.userId, subjectReference, termsHash: String(document.contentHash), evidenceType: input.evidenceType, safeRequestEvidence: { source: safeOperationalText(input.source, 80), ...(input.safeRequestEvidence ?? {}) } } });
  await recordAdminActivity({ actorUserId: input.userId, action: "STATUS_CHANGE", entityType: "LegalDocumentAcceptance", entityId: String(acceptance.id), message: input.evidenceType === "TERMS_ACCEPTANCE" ? "Accepted terms version" : "Acknowledged privacy notice version", metadata: { documentReference: String(document.publicReference), documentType: input.documentType, evidenceType: input.evidenceType } });
  return { acceptance, document: safePublicDocument(document) };
}

export async function acknowledgePrivacyNotice(input: { userId: string; publicReference?: string; jurisdiction?: string; source: string; safeRequestEvidence?: Record<string, unknown> }) { return recordTypedAcceptance({ ...input, documentType: LEGAL_DOCUMENT_TYPES.PRIVACY_NOTICE, evidenceType: "PRIVACY_NOTICE_ACKNOWLEDGEMENT" }); }
export async function acceptTerms(input: { userId: string; publicReference?: string; jurisdiction?: string; source: string; safeRequestEvidence?: Record<string, unknown> }) { return recordTypedAcceptance({ ...input, documentType: LEGAL_DOCUMENT_TYPES.TERMS_OF_SERVICE, evidenceType: "TERMS_ACCEPTANCE" }); }

export async function getTermsStatusForUser(userId: string, input: { jurisdiction?: string } = {}) {
  const current = await resolveEffectiveLegalDocument(LEGAL_DOCUMENT_TYPES.TERMS_OF_SERVICE, input);
  if (!current) return { current: null, acceptedVersions: [], acceptanceRequired: false, currentAccepted: false };
  const acceptances = await phase5Repository.legalDocumentAcceptance.findMany({ where: { userId, subjectReference: "TERMS_ACCEPTANCE" }, take: 200 });
  const acceptedVersions = acceptances.map((acceptance: any) => ({ documentVersionId: acceptance.documentVersionId, acceptedAt: acceptance.acceptedAt }));
  return { current: safePublicDocument(current), acceptedVersions, currentAccepted: acceptances.some((acceptance: any) => String(acceptance.documentVersionId) === String(current.id)), acceptanceRequired: !acceptances.some((acceptance: any) => String(acceptance.documentVersionId) === String(current.id)) };
}

export async function getCurrentPrivacyNotice(input: { jurisdiction?: string } = {}) { const document = await resolveEffectiveLegalDocument(LEGAL_DOCUMENT_TYPES.PRIVACY_NOTICE, input); return document ? safePublicDocument(document) : null; }
export async function getCurrentTerms(input: { jurisdiction?: string } = {}) { const document = await resolveEffectiveLegalDocument(LEGAL_DOCUMENT_TYPES.TERMS_OF_SERVICE, input); return document ? safePublicDocument(document) : null; }
export async function getCurrentPolicy(documentType: "REFUND_POLICY" | "SHIPPING_POLICY", input: { jurisdiction?: string } = {}) { const document = await resolveEffectiveLegalDocument(documentType, input); return document ? safePublicDocument(document) : null; }

// Compatibility entry point for earlier legal-document callers. New Terms and
// Privacy actions use the typed authenticated operations above.
export async function recordLegalAcceptance(input: { userId: string; publicReference: string; subjectReference?: string; termsHash: string; safeRequestEvidence?: Record<string, unknown>; }) {
  const document = await phase5Repository.legalDocumentVersion.findUnique({ where: { publicReference: input.publicReference } });
  if (!document || document.publicationStatus !== "PUBLISHED") throw new LegalDocumentError("LEGAL_DOCUMENT_NOT_PUBLISHED", "A published legal document version is required.");
  if (input.termsHash !== document.contentHash) throw new LegalDocumentError("LEGAL_DOCUMENT_ACCEPTANCE_CONFLICT", "Legal document acceptance does not match the published terms hash.");
  return phase5Repository.legalDocumentAcceptance.upsert({ where: { documentVersionId_userId_subjectReference: { documentVersionId: String(document.id), userId: input.userId, subjectReference: input.subjectReference ?? "" } }, update: {}, create: { documentVersionId: String(document.id), userId: input.userId, subjectReference: input.subjectReference ?? "", termsHash: input.termsHash, evidenceType: "LEGACY_ACCEPTANCE", safeRequestEvidence: input.safeRequestEvidence ?? null } });
}
