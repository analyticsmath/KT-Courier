/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import {
  RecruitmentCheckType,
  RecruitmentCheckCaseStatus,
  RecruitmentVersionStatus,
} from "@/types/db";
import { RecruitmentCreditCheckNotAuthorizedError, RecruitmentError } from "./errors";

export class BackgroundCheckService {
  constructor(private readonly db: any) {}

  async createPolicyVersion(input: {
    versionNumber: number;
    recruitmentTrack: any;
    identityCheckRequired?: boolean;
    workAuthorizationCheckRequired?: boolean;
    qualificationCheckRequired?: boolean;
    referenceCheckRequired?: boolean;
    criminalCheckPolicy?: string;
    creditCheckPolicy?: string;
    licenceCheckPolicy?: string;
    prdpCheckPolicy?: string;
    medicalFitnessPolicy?: string;
    psychometricPolicy?: string;
  }) {
    const publicReference = `BCP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return this.db.recruitmentBackgroundCheckPolicyVersion.create({
      data: {
        publicReference,
        versionNumber: input.versionNumber,
        status: RecruitmentVersionStatus.DRAFT,
        recruitmentTrack: input.recruitmentTrack,
        identityCheckRequired: input.identityCheckRequired ?? true,
        workAuthorizationCheckRequired: input.workAuthorizationCheckRequired ?? true,
        qualificationCheckRequired: input.qualificationCheckRequired ?? false,
        referenceCheckRequired: input.referenceCheckRequired ?? false,
        criminalCheckPolicy: input.criminalCheckPolicy || "ROLE_LIMITED",
        creditCheckPolicy: input.creditCheckPolicy || "ROLE_LIMITED",
        licenceCheckPolicy: input.licenceCheckPolicy || "NOT_REQUIRED",
        prdpCheckPolicy: input.prdpCheckPolicy || "NOT_REQUIRED",
        medicalFitnessPolicy: input.medicalFitnessPolicy || "NOT_REQUIRED",
        psychometricPolicy: input.psychometricPolicy || "NOT_REQUIRED",
      },
    });
  }

  async initiateCheckCase(input: {
    applicationId: string;
    checkType: RecruitmentCheckType;
    policyVersionId: string;
    consentRecordId?: string;
    operationId: string;
    requestHash: string;
  }) {
    // Credit check boundary validation
    if (input.checkType === RecruitmentCheckType.ROLE_RELATED_CREDIT) {
      const application = await this.db.recruitmentApplication.findUnique({
        where: { id: input.applicationId },
        include: { openingVersion: true },
      });

      const positionRequiresFinance =
        application?.openingVersion?.relationshipClassification?.includes("FINANCE") ||
        application?.openingVersion?.publicTitle?.toUpperCase().includes("CASH") ||
        application?.openingVersion?.publicTitle?.toUpperCase().includes("FINANCE");

      if (!positionRequiresFinance) {
        throw new RecruitmentCreditCheckNotAuthorizedError();
      }

      if (!input.consentRecordId) {
        throw new RecruitmentError("Credit checks require candidate written consent record.");
      }
    }

    const publicReference = `CHK-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return this.db.recruitmentCheckCase.create({
      data: {
        publicReference,
        applicationId: input.applicationId,
        checkType: input.checkType,
        policyVersionId: input.policyVersionId,
        consentRecordId: input.consentRecordId || null,
        status: RecruitmentCheckCaseStatus.READY,
        requestedAt: new Date(),
        operationId: input.operationId,
        requestHash: input.requestHash,
      },
    });
  }

  async recordCheckResult(
    checkReference: string,
    result: {
      status: RecruitmentCheckCaseStatus;
      resultClassification: string;
      safeSummary: string;
      restrictedEvidenceReference?: string;
      reviewedByUserId?: string;
      reviewReason?: string;
    }
  ) {
    return this.db.recruitmentCheckCase.update({
      where: { publicReference: checkReference },
      data: {
        status: result.status,
        resultClassification: result.resultClassification,
        safeSummary: result.safeSummary,
        restrictedEvidenceReference: result.restrictedEvidenceReference || null,
        reviewedByUserId: result.reviewedByUserId || null,
        reviewReason: result.reviewReason || null,
        completedAt: new Date(),
      },
    });
  }

  async requestCheck(reference: string) {
    return this.db.recruitmentCheckCase.update({
      where: { publicReference: reference },
      data: { status: RecruitmentCheckCaseStatus.REQUESTED, requestedAt: new Date() },
    });
  }

  async getCheckCasesForApplication(applicationId: string) {
    return this.db.recruitmentCheckCase.findMany({
      where: { applicationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async listCheckCases(filter?: { status?: string }) {
    const where: any = {};
    if (filter?.status) where.status = filter.status;

    return this.db.recruitmentCheckCase.findMany({
      where,
      include: {
        application: {
          include: { applicantProfile: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getCheckCaseByReference(reference: string) {
    return this.db.recruitmentCheckCase.findUnique({
      where: { publicReference: reference },
      include: {
        application: {
          include: { applicantProfile: true },
        },
        policyVersion: true,
        consentRecord: true,
      },
    });
  }

  async reviewCheckResult(reference: string, reviewerUserId: string, reviewReason: string) {
    return this.db.recruitmentCheckCase.update({
      where: { publicReference: reference },
      data: {
        status: RecruitmentCheckCaseStatus.PASSED,
        reviewedByUserId: reviewerUserId,
        reviewReason,
        reviewedAt: new Date(),
      },
    });
  }

  async recordApplicantConsent(checkReference: string, consentRecordId: string) {
    return this.db.recruitmentCheckCase.update({
      where: { publicReference: checkReference },
      data: { consentRecordId },
    });
  }
}
