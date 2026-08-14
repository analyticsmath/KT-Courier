import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOperationalIncident, getOperationalIncident, transitionOperationalIncident } from "@/lib/services/operational-incidents.service";
import { createLegalDocumentDraft, publishLegalDocumentVersion } from "@/lib/services/legal-documents.service";
import { createPrivacyRequest, transitionPrivacyRequest } from "@/lib/services/privacy-requests.service";

beforeAll(() => { process.env.PHASE5_REPOSITORY_USE_MEMORY = "true"; process.env.PHASE5_REPOSITORY_TEST_MEMORY = "true"; });
afterAll(() => { delete process.env.PHASE5_REPOSITORY_USE_MEMORY; delete process.env.PHASE5_REPOSITORY_TEST_MEMORY; });

describe("Phase 5: Admin Operations & Governance Services", () => {
  it("creates, transitions, and reads operational incident with append-only timeline", async () => {
    const actorUserId = "usr-admin-inc";
    const incident = await createOperationalIncident({
      actorUserId,
      severity: "HIGH",
      category: "Gateway Timeout",
      safeSummary: "Payment provider gateway timeout spike detected",
      affectedCapabilities: ["payments", "checkout"],
    });
    if (!incident) throw new Error("Operational incident creation returned no incident.");

    const incRef = String(incident.publicReference);
    expect(incRef).toMatch(/^INC-/);
    expect(incident.status).toBe("OPEN");

    const detail = await getOperationalIncident(incRef);
    expect(detail).toBeDefined();
    expect(detail?.timeline.length).toBeGreaterThanOrEqual(1);

    const opId = `INCOP-${Date.now()}-TRANS`;
    const updated = await transitionOperationalIncident({
      actorUserId,
      publicReference: incRef,
      nextStatus: "INVESTIGATING",
      reasonCode: "INVESTIGATION_STARTED",
      note: "Assigned engineering commander",
      operationId: opId,
    });

    expect(updated.status).toBe("INVESTIGATING");

    const updatedDetail = await getOperationalIncident(incRef);
    expect(updatedDetail?.timeline.length).toBeGreaterThanOrEqual(2);
  });

  it("creates draft legal document and enforces immutability on publication", async () => {
    const actorUserId = "usr-legal-admin";
    const sampleContentHash = "a".repeat(64); // 64-char sha256 hex string

    const draft = await createLegalDocumentDraft({
      actorUserId,
      documentType: "TEST_TERMS",
      version: `v${Date.now()}`,
      jurisdiction: "ZA",
      contentHash: sampleContentHash,
      acceptancePolicy: "MANDATORY_EXPLICIT_CHECK",
    });

    const docRef = String(draft.publicReference);
    expect(docRef).toMatch(/^LEGAL-/);
    expect(draft.publicationStatus).toBe("DRAFT");

    const opId = `LEGALOP-${Date.now()}-PUB`;
    const published = await publishLegalDocumentVersion({
      actorUserId,
      publicReference: docRef,
      operationId: opId,
    });

    expect(published.publicationStatus).toBe("PUBLISHED");

    // Second publish call with same operationId is idempotent
    const rePublished = await publishLegalDocumentVersion({
      actorUserId,
      publicReference: docRef,
      operationId: opId,
    });
    expect(rePublished.publicationStatus).toBe("PUBLISHED");

    // Second publish call with different operationId throws immutability error
    await expect(
      publishLegalDocumentVersion({
        actorUserId,
        publicReference: docRef,
        operationId: `LEGALOP-${Date.now()}-DIFF`,
      }),
    ).rejects.toThrow(/Published legal document versions are immutable/);
  });

  it("requires identity verification before advancing privacy request fulfilment", async () => {
    const opId = `PRIVOP-${Date.now()}-CREATE`;
    const req = await createPrivacyRequest({
      requesterUserId: "usr-privacy-requester",
      requestType: "ACCESS",
      scope: ["user_profile", "order_history"],
      operationId: opId,
    });

    const reqRef = String(req.publicReference);
    expect(reqRef).toMatch(/^DSAR-/);
    expect(req.identityVerificationStatus).toBe("REQUIRED");

    const reviewed = await transitionPrivacyRequest({
      actorUserId: "usr-privacy-admin",
      publicReference: reqRef,
      nextStatus: "UNDER_REVIEW",
      reasonCode: "ID_VERIFIED_AND_REVIEW_STARTED",
      identityVerified: true,
      operationId: `PRIVOP-${Date.now()}-REVIEW`,
    });
    expect(reviewed.status).toBe("UNDER_REVIEW");
    expect(reviewed.identityVerificationStatus).toBe("VERIFIED");

    const req2 = await createPrivacyRequest({
      requesterUserId: "usr-privacy-requester-unverified",
      requestType: "DELETION_OR_ANONYMISATION",
      scope: ["user_profile"],
      operationId: `PRIVOP-${Date.now()}-UNVERIFIED`,
    });

    const req2Ref = String(req2.publicReference);
    await expect(
      transitionPrivacyRequest({
        actorUserId: "usr-privacy-admin",
        publicReference: req2Ref,
        nextStatus: "UNDER_REVIEW",
        reasonCode: "REVIEW_WITHOUT_VERIFICATION",
        operationId: `PRIVOP-${Date.now()}-UNV-TRY`,
      }),
    ).rejects.toMatchObject({ code: "PRIVACY_IDENTITY_VERIFICATION_REQUIRED" });
  });
});
