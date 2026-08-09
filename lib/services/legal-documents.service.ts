import crypto from "node:crypto";
import { recordAdminActivity } from "./admin-activity.service";
import { phase5Reference, phase5Repository, safeOperationalText } from "@/lib/operations/phase5-repository";

export async function listLegalDocumentVersions() {
  return phase5Repository.legalDocumentVersion.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export async function getLegalDocumentVersion(publicReference: string) {
  const doc = await phase5Repository.legalDocumentVersion.findUnique({ where: { publicReference } });
  if (!doc) return null;

  const acceptances = await phase5Repository.legalDocumentAcceptance.findMany({
    where: { documentVersionId: String(doc.id) },
    take: 50,
  }).catch(() => []);

  return {
    ...doc,
    acceptancesCount: acceptances.length,
    recentAcceptances: acceptances,
  };
}

export async function createLegalDocumentDraft(input: {
  actorUserId: string;
  documentType: string;
  version: string;
  jurisdiction: string;
  contentHash: string;
  acceptancePolicy?: string;
}) {
  if (!/^[a-f0-9]{64}$/i.test(input.contentHash)) throw new Error("Legal document content hash is invalid.");

  const document = await phase5Repository.legalDocumentVersion.create({
    data: {
      publicReference: phase5Reference("LEGAL"),
      documentType: safeOperationalText(input.documentType, 80),
      version: safeOperationalText(input.version, 80),
      jurisdiction: safeOperationalText(input.jurisdiction, 80),
      contentHash: input.contentHash.toLowerCase(),
      acceptancePolicy: input.acceptancePolicy ? safeOperationalText(input.acceptancePolicy, 160) : null,
    },
  });

  await recordAdminActivity({
    actorUserId: input.actorUserId,
    action: "CREATE",
    entityType: "LegalDocumentVersion",
    entityId: String(document.id),
    message: "Created legal document draft",
    metadata: { reference: String(document.publicReference) },
  });

  return document;
}

export async function publishLegalDocumentVersion(input: {
  actorUserId: string;
  publicReference: string;
  operationId: string;
  effectiveAt?: Date;
}) {
  const document = await phase5Repository.legalDocumentVersion.findUnique({ where: { publicReference: input.publicReference } });
  if (!document) throw new Error("Legal document version not found.");

  if (document.publicationStatus !== "DRAFT") {
    if (document.publicationOperationId === input.operationId) return document;
    throw new Error("Published legal document versions are immutable.");
  }

  const update = await phase5Repository.legalDocumentVersion.update({
    where: { id: document.id },
    data: {
      publicationStatus: "PUBLISHED",
      publishedByUserId: input.actorUserId,
      publishedAt: new Date(),
      effectiveAt: input.effectiveAt ?? new Date(),
      publicationOperationId: input.operationId,
    },
  });

  await recordAdminActivity({
    actorUserId: input.actorUserId,
    action: "STATUS_CHANGE",
    entityType: "LegalDocumentVersion",
    entityId: String(document.id),
    message: "Published immutable legal document version",
    metadata: {
      operationId: input.operationId,
      contentHash: crypto.createHash("sha256").update(String(document.contentHash)).digest("hex").slice(0, 16),
    },
  });

  return update;
}

export async function recordLegalAcceptance(input: {
  userId: string;
  publicReference: string;
  subjectReference?: string;
  termsHash: string;
  safeRequestEvidence?: Record<string, unknown>;
}) {
  const document = await phase5Repository.legalDocumentVersion.findUnique({ where: { publicReference: input.publicReference } });
  if (!document || document.publicationStatus !== "PUBLISHED") throw new Error("A published legal document version is required.");
  if (input.termsHash !== document.contentHash) throw new Error("Legal document acceptance does not match the published terms hash.");

  return phase5Repository.legalDocumentAcceptance.upsert({
    where: {
      documentVersionId_userId_subjectReference: {
        documentVersionId: String(document.id),
        userId: input.userId,
        subjectReference: input.subjectReference ?? "",
      },
    },
    update: {},
    create: {
      documentVersionId: String(document.id),
      userId: input.userId,
      subjectReference: input.subjectReference ?? "",
      termsHash: input.termsHash,
      safeRequestEvidence: input.safeRequestEvidence ?? null,
    },
  });
}
