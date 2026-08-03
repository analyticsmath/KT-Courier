/* eslint-disable @typescript-eslint/no-explicit-any -- focused fake repositories exercise DB-free adapter boundaries. */
import { beforeEach, describe, expect, it } from "vitest";
import { RecruitmentSecureDocumentAdapter, RECRUITMENT_DOCUMENT_CATEGORIES } from "@/lib/recruitment/secure-document.adapter";
import { RecruitmentError } from "@/lib/recruitment/errors";

describe("Phase 26 Secure Document Authority", () => {
  let db: any;
  let adapter: RecruitmentSecureDocumentAdapter;

  beforeEach(() => {
    db = {
      recruitmentApplication: {
        findUnique: async ({ where }: any) => {
          if (where.id === "app-1") {
            return { id: "app-1", applicantProfileId: "applicant-1" };
          }
          return null;
        },
      },
      recruitmentApplicationDocument: {
        create: async ({ data }: any) => ({ id: "doc-1", ...data }),
        findUnique: async ({ where }: any) => {
          if (where.id === "doc-1") {
            return {
              id: "doc-1",
              publicReference: "DOC-100",
              documentCategory: "IDENTITY_DOCUMENT",
              mediaReference: "secure/storage/key/id-doc.pdf",
              originalFileName: "passport.pdf",
              mimeType: "application/pdf",
              fileSizeBytes: 102400,
              validationStatus: "VALIDATED",
              expiryDate: new Date("2030-01-01"),
              historicalVersion: 1,
              isLatest: true,
              applicationId: "app-1",
              application: { applicantProfileId: "applicant-1" },
            };
          }
          return null;
        },
        update: async ({ data }: any) => ({ id: "doc-1", ...data }),
      },
      recruitmentEventIntent: {
        create: async ({ data }: any) => ({ id: "event-1", ...data }),
      },
    };
    adapter = new RecruitmentSecureDocumentAdapter(db);
  });

  it("proves recruitment documents support all 10 required document categories", () => {
    expect(RECRUITMENT_DOCUMENT_CATEGORIES).toEqual([
      "CV",
      "QUALIFICATION_CERTIFICATE",
      "IDENTITY_DOCUMENT",
      "WORK_AUTHORIZATION",
      "DRIVING_LICENCE",
      "PROFESSIONAL_DRIVING_PERMIT",
      "VEHICLE_REGISTRATION",
      "PROOF_OF_ADDRESS",
      "REFERENCE_DOCUMENT",
      "OTHER_ROLE_REQUIRED",
    ]);
  });

  it("enforces applicant ownership during trusted document creation", async () => {
    await expect(
      adapter.createTrustedDocument({
        applicationId: "app-1",
        applicantProfileId: "other-applicant",
        documentCategory: "CV",
        mediaReference: "storage/cv.pdf",
        originalFileName: "cv.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 5000,
      })
    ).rejects.toBeInstanceOf(RecruitmentError);
  });

  it("verifies applicant document ownership correctly", async () => {
    const isOwner = await adapter.verifyDocumentOwnership("doc-1", "applicant-1");
    expect(isOwner).toBe(true);

    const isNotOwner = await adapter.verifyDocumentOwnership("doc-1", "other-applicant");
    expect(isNotOwner).toBe(false);
  });

  it("preserves submitted history during document replacement without destructive overwrite", async () => {
    const updated = await adapter.replaceDocumentWithHistory({
      previousDocumentId: "doc-1",
      applicantProfileId: "applicant-1",
      mediaReference: "storage/new-passport.pdf",
      originalFileName: "new-passport.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 120000,
    });

    expect(updated.historicalVersion).toBe(2);
    expect(updated.previousVersionId).toBe("doc-1");
    expect(updated.isLatest).toBe(true);
  });

  it("restricts document access for ordinary reviewers without special access permissions", async () => {
    await expect(
      adapter.accessRestrictedDocument("doc-1", {
        userId: "reviewer-1",
        role: "REVIEWER",
        permissions: ["recruitment_view_documents"],
      })
    ).rejects.toThrow("Access to special identity/licence document restricted.");
  });

  it("hides raw storage keys in DTOs for ordinary reviewers", async () => {
    const dto = await adapter.accessRestrictedDocument("doc-1", {
      userId: "reviewer-1",
      role: "REVIEWER",
      permissions: ["recruitment_view_documents", "recruitment_view_special_information"],
    });

    expect(dto.storageReference).toBe("[RESTRICTED]");
    expect(dto.documentCategory).toBe("IDENTITY_DOCUMENT");
  });

  it("produces access audit evidence on document access", async () => {
    let auditCreated = false;
    db.recruitmentEventIntent.create = async ({ data }: any) => {
      if (data.eventType === "RECRUITMENT_DOCUMENT_DOCUMENT_ACCESSED") {
        auditCreated = true;
      }
      return { id: "event-1", ...data };
    };

    await adapter.accessRestrictedDocument("doc-1", {
      userId: "applicant-1",
      role: "APPLICANT",
      permissions: [],
    });

    expect(auditCreated).toBe(true);
  });
});
