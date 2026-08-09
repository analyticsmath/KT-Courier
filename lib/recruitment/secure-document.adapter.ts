/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { assertRecruitmentProductionReady } from "./production-readiness";
import { RecruitmentError } from "./errors";

export const RECRUITMENT_DOCUMENT_CATEGORIES = [
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
] as const;

export type RecruitmentDocumentCategory = (typeof RECRUITMENT_DOCUMENT_CATEGORIES)[number];

export interface SecureDocumentCreationInput {
  applicationId: string;
  applicantProfileId: string;
  documentCategory: RecruitmentDocumentCategory;
  mediaReference: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  expiryDate?: Date | null;
}

export interface SecureDocumentAccessor {
  userId: string;
  role: string;
  permissions: string[];
}

export class RecruitmentSecureDocumentAdapter {
  constructor(private readonly db: any) {}

  async createTrustedDocument(input: SecureDocumentCreationInput) {
    if (!RECRUITMENT_DOCUMENT_CATEGORIES.includes(input.documentCategory)) {
      throw new RecruitmentError(`Invalid document category: ${input.documentCategory}`);
    }

    const application = await this.db.recruitmentApplication.findUnique({
      where: { id: input.applicationId },
    });

    if (!application) {
      throw new RecruitmentError("Application not found.");
    }

    if (application.applicantProfileId !== input.applicantProfileId) {
      throw new RecruitmentError("Applicant ownership mismatch for document creation.");
    }

    const documentRef = `DOC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const doc = await this.db.recruitmentApplicationDocument.create({
      data: {
        publicReference: documentRef,
        applicationId: input.applicationId,
        documentCategory: input.documentCategory,
        mediaReference: input.mediaReference,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        validationStatus: "VALIDATED",
        expiryDate: input.expiryDate || null,
        historicalVersion: 1,
        isLatest: true,
      },
    });

    await this.recordAuditEvidence({
      documentId: doc.id,
      action: "DOCUMENT_CREATED",
      userId: input.applicantProfileId,
    });

    return doc;
  }

  async verifyDocumentOwnership(documentId: string, applicantProfileId: string): Promise<boolean> {
    const doc = await this.db.recruitmentApplicationDocument.findUnique({
      where: { id: documentId },
      include: { application: true },
    });

    if (!doc) return false;
    return doc.application.applicantProfileId === applicantProfileId;
  }

  async replaceDocumentWithHistory(input: {
    previousDocumentId: string;
    applicantProfileId: string;
    mediaReference: string;
    originalFileName: string;
    mimeType: string;
    fileSizeBytes: number;
    expiryDate?: Date | null;
  }) {
    const previous = await this.db.recruitmentApplicationDocument.findUnique({
      where: { id: input.previousDocumentId },
      include: { application: true },
    });

    if (!previous) {
      throw new RecruitmentError("Previous document not found.");
    }

    if (previous.application.applicantProfileId !== input.applicantProfileId) {
      throw new RecruitmentError("Applicant ownership mismatch for document replacement.");
    }

    // Preserve submitted history: mark previous version as not latest, create new historical version
    await this.db.recruitmentApplicationDocument.update({
      where: { id: previous.id },
      data: { isLatest: false, archivedAt: new Date() },
    });

    const newVersionNumber = (previous.historicalVersion || 1) + 1;
    const documentRef = `DOC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const newDoc = await this.db.recruitmentApplicationDocument.create({
      data: {
        publicReference: documentRef,
        applicationId: previous.applicationId,
        documentCategory: previous.documentCategory,
        mediaReference: input.mediaReference,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        validationStatus: "VALIDATED",
        expiryDate: input.expiryDate || null,
        historicalVersion: newVersionNumber,
        previousVersionId: previous.id,
        isLatest: true,
      },
    });

    await this.recordAuditEvidence({
      documentId: newDoc.id,
      action: "DOCUMENT_REPLACED",
      userId: input.applicantProfileId,
      metadata: { previousDocumentId: previous.id, newVersion: newVersionNumber },
    });

    return newDoc;
  }

  async accessRestrictedDocument(documentId: string, accessor: SecureDocumentAccessor) {
    const doc = await this.db.recruitmentApplicationDocument.findUnique({
      where: { id: documentId },
      include: { application: true },
    });

    if (!doc) {
      throw new RecruitmentError("Document not found.");
    }

    const isApplicantOwner = doc.application.applicantProfileId === accessor.userId;
    const hasAdminAccess = accessor.permissions.includes("recruitment_view_documents");

    if (!isApplicantOwner && !hasAdminAccess) {
      throw new RecruitmentError("Access to restricted document denied.");
    }

    // Special information restriction checks
    if (["IDENTITY_DOCUMENT", "DRIVING_LICENCE", "PROFESSIONAL_DRIVING_PERMIT"].includes(doc.documentCategory)) {
      const hasSpecialAccess = accessor.permissions.includes("recruitment_view_special_information");
      if (!isApplicantOwner && !hasSpecialAccess) {
        throw new RecruitmentError("Access to special identity/licence document restricted.");
      }
    }

    await this.recordAuditEvidence({
      documentId: doc.id,
      action: "DOCUMENT_ACCESSED",
      userId: accessor.userId,
      metadata: { accessorRole: accessor.role },
    });

    return this.projectSafeDocumentDto(doc, accessor);
  }

  projectSafeDocumentDto(doc: any, _accessor: SecureDocumentAccessor) {
    void _accessor;
    return {
      id: doc.id,
      publicReference: doc.publicReference,
      documentCategory: doc.documentCategory,
      originalFileName: doc.originalFileName,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes,
      validationStatus: doc.validationStatus,
      expiryDate: doc.expiryDate,
      historicalVersion: doc.historicalVersion,
      isLatest: doc.isLatest,

      // Never expose raw storage key to applicants or ordinary reviewers in DTOs
      storageReference: "[RESTRICTED]",
    };
  }

  async recordAuditEvidence(input: {
    documentId: string;
    action: string;
    userId: string;
    metadata?: object;
  }) {
    return this.db.recruitmentEventIntent.create({
      data: {
        eventType: `RECRUITMENT_DOCUMENT_${input.action}`,
        aggregateReference: input.documentId,
        operationId: `AUDIT-${Date.now()}`,
        safePayload: {
          userId: input.userId,
          action: input.action,
          timestamp: new Date().toISOString(),
          ...input.metadata,
        },
      },
    });
  }

  assertProductionReadiness() {
    assertRecruitmentProductionReady();
  }
}
