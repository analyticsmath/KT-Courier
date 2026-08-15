/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { UserRole, UserStatus } from "@/types/db";
import { LEGAL_DOCUMENT_TYPES, acceptTerms, acknowledgePrivacyNotice, createLegalDocumentDraft, getCurrentPrivacyNotice, getTermsStatusForUser, publishLegalDocumentVersion, resolveEffectiveLegalDocument } from "@/lib/services/legal-documents.service";

const marker = `LPV${randomUUID().replaceAll("-", "").toUpperCase()}`;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
let adminId = "";
let userAId = "";
let userBId = "";

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
  const [admin, userA, userB] = await Promise.all([
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-admin@example.test`, passwordHash: "phase-b-test-only", name: "Legal admin", role: UserRole.ADMIN, status: UserStatus.ACTIVE } }),
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-a@example.test`, passwordHash: "phase-b-test-only", name: "Legal user A", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE } }),
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-b@example.test`, passwordHash: "phase-b-test-only", name: "Legal user B", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE } }),
  ]);
  adminId = admin.id; userAId = userA.id; userBId = userB.id;
});

async function draftAndPublish(documentType: string, version: string, content: string, operationId: string) {
  const draft = await createLegalDocumentDraft({ actorUserId: adminId, documentType, version, jurisdiction: "ZA", content, contentHash: hash(content), acceptancePolicy: "CURRENT_VERSION_REQUIRED" });
  return publishLegalDocumentVersion({ actorUserId: adminId, publicReference: String(draft.publicReference), operationId, effectiveAt: new Date("2025-01-01T00:00:00.000Z") });
}

describe("Phase B Privacy Notice and Terms PostgreSQL production-service proof", () => {
  it("preserves immutable versions and exact separate Terms/Privacy evidence", async () => {
    const privacyA = await draftAndPublish(LEGAL_DOCUMENT_TYPES.PRIVACY_NOTICE, `${marker}-PRIV-A`, `Privacy A ${marker}`, `LEGALOP-${marker}-PRIV-A`);
    const termsA = await draftAndPublish(LEGAL_DOCUMENT_TYPES.TERMS_OF_SERVICE, `${marker}-TERMS-A`, `Terms A ${marker}`, `LEGALOP-${marker}-TERMS-A`);
    const termsAcceptanceA = await acceptTerms({ userId: userAId, publicReference: String(termsA.publicReference), source: "POSTGRES_PROOF" });
    const privacyAcknowledgementA = await acknowledgePrivacyNotice({ userId: userAId, publicReference: String(privacyA.publicReference), source: "POSTGRES_PROOF" });
    await expect(acceptTerms({ userId: userBId, publicReference: String(termsA.publicReference), source: "POSTGRES_PROOF" })).resolves.toMatchObject({ document: { publicReference: termsA.publicReference } });
    await acceptTerms({ userId: userAId, publicReference: String(termsA.publicReference), source: "POSTGRES_PROOF" });
    const privacyB = await draftAndPublish(LEGAL_DOCUMENT_TYPES.PRIVACY_NOTICE, `${marker}-PRIV-B`, `Privacy B ${marker}`, `LEGALOP-${marker}-PRIV-B`);
    const termsB = await draftAndPublish(LEGAL_DOCUMENT_TYPES.TERMS_OF_SERVICE, `${marker}-TERMS-B`, `Terms B ${marker}`, `LEGALOP-${marker}-TERMS-B`);
    expect((await getCurrentPrivacyNotice({ jurisdiction: "ZA" }))?.publicReference).toBe(privacyB.publicReference);
    expect((await resolveEffectiveLegalDocument(LEGAL_DOCUMENT_TYPES.TERMS_OF_SERVICE, { jurisdiction: "ZA" }))?.publicReference).toBe(termsB.publicReference);
    expect(termsAcceptanceA.acceptance.documentVersionId).not.toBe(String(termsB.id));
    expect(privacyAcknowledgementA.acceptance.documentVersionId).not.toBe(String(privacyB.id));
    const userAStatus = await getTermsStatusForUser(userAId, { jurisdiction: "ZA" });
    expect(userAStatus.currentAccepted).toBe(false);
    expect(userAStatus.acceptanceRequired).toBe(true);
    const persisted = await (prisma as any).legalDocumentAcceptance.findMany({ where: { userId: userAId } });
    expect(persisted.filter((row: any) => row.evidenceType === "TERMS_ACCEPTANCE")).toHaveLength(1);
    expect(persisted.filter((row: any) => row.evidenceType === "PRIVACY_NOTICE_ACKNOWLEDGEMENT")).toHaveLength(1);
  });
});
