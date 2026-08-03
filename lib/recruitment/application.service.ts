/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { RecruitmentApplicationState } from "@/types/db";
import { assertRecruitmentProductionReady } from "./production-readiness";
import { RecruitmentError } from "./errors";

export class ApplicationService {
  constructor(private readonly db: any) {}

  async createDraftApplication(input: {
    applicantProfileId: string;
    openingId: string;
    openingVersionId: string;
    applicationFormVersionId: string;
    operationId: string;
    requestHash: string;
  }) {
    // Check if duplicate draft or active application exists for this opening
    const existing = await this.db.recruitmentApplication.findFirst({
      where: {
        applicantProfileId: input.applicantProfileId,
        openingId: input.openingId,
        status: {
          notIn: [
            RecruitmentApplicationState.WITHDRAWN,
            RecruitmentApplicationState.REJECTED,
            RecruitmentApplicationState.OFFER_DECLINED,
            RecruitmentApplicationState.OFFER_EXPIRED,
            RecruitmentApplicationState.OPENING_CANCELLED,
          ],
        },
      },
    });

    if (existing) {
      return existing;
    }

    const publicReference = `APP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return this.db.recruitmentApplication.create({
      data: {
        publicReference,
        applicantProfileId: input.applicantProfileId,
        openingId: input.openingId,
        openingVersionId: input.openingVersionId,
        applicationFormVersionId: input.applicationFormVersionId,
        status: RecruitmentApplicationState.DRAFT,
        currentStage: "DRAFT",
        operationId: input.operationId,
        requestHash: input.requestHash,
      },
    });
  }

  async saveSubmittedAnswers(applicationId: string, answers: Array<{ questionKey: string; answerValue: any }>) {
    const application = await this.db.recruitmentApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) throw new RecruitmentError("Application not found.");
    if (application.status !== RecruitmentApplicationState.DRAFT) {
      throw new RecruitmentError("Cannot modify answers for a submitted application.");
    }

    const savePromises = answers.map((ans) =>
      this.db.recruitmentSubmittedAnswer.upsert({
        where: {
          applicationId_questionKey: {
            applicationId,
            questionKey: ans.questionKey,
          },
        },
        update: { answerValue: ans.answerValue },
        create: {
          applicationId,
          questionKey: ans.questionKey,
          answerValue: ans.answerValue,
        },
      })
    );

    return Promise.all(savePromises);
  }

  async saveApplicationDocument(input: {
    applicationId: string;
    documentCategory: string;
    mediaReference: string;
    originalFileName: string;
    mimeType: string;
    fileSizeBytes: number;
    expiryDate?: Date;
  }) {
    const application = await this.db.recruitmentApplication.findUnique({
      where: { id: input.applicationId },
    });

    if (!application) throw new RecruitmentError("Application not found.");
    if (application.status !== RecruitmentApplicationState.DRAFT) {
      throw new RecruitmentError("Cannot add documents to a submitted application.");
    }

    return this.db.recruitmentApplicationDocument.create({
      data: {
        applicationId: input.applicationId,
        documentCategory: input.documentCategory,
        mediaReference: input.mediaReference,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        validationStatus: "VALIDATED",
        expiryDate: input.expiryDate || null,
      },
    });
  }

  async submitApplication(reference: string) {
    assertRecruitmentProductionReady();

    const application = await this.db.recruitmentApplication.findUnique({
      where: { publicReference: reference },
      include: {
        answers: true,
        documents: true,
        openingVersion: true,
      },
    });

    if (!application) throw new RecruitmentError("Application not found.");
    if (application.status !== RecruitmentApplicationState.DRAFT) {
      throw new RecruitmentError("Application is already submitted or in an advanced state.");
    }

    return this.db.recruitmentApplication.update({
      where: { publicReference: reference },
      data: {
        status: RecruitmentApplicationState.SUBMITTED,
        currentStage: "SUBMITTED",
        submittedAt: new Date(),
        optimisticVersion: { increment: 1 },
      },
    });
  }

  async withdrawApplication(reference: string) {
    return this.db.recruitmentApplication.update({
      where: { publicReference: reference },
      data: {
        status: RecruitmentApplicationState.WITHDRAWN,
        currentStage: "WITHDRAWN",
        withdrawnAt: new Date(),
        optimisticVersion: { increment: 1 },
      },
    });
  }

  async getApplicationByReference(reference: string) {
    return this.db.recruitmentApplication.findUnique({
      where: { publicReference: reference },
      include: {
        applicantProfile: true,
        opening: true,
        openingVersion: true,
        formVersion: true,
        answers: true,
        documents: true,
        decisions: true,
        interviews: true,
        checkCases: true,
        offers: true,
        handoffs: true,
      },
    });
  }

  async listApplications(filter?: { applicantProfileId?: string; openingId?: string; status?: string }) {
    const where: any = {};
    if (filter?.applicantProfileId) where.applicantProfileId = filter.applicantProfileId;
    if (filter?.openingId) where.openingId = filter.openingId;
    if (filter?.status) where.status = filter.status;

    return this.db.recruitmentApplication.findMany({
      where,
      include: {
        applicantProfile: true,
        opening: true,
        openingVersion: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async assignReviewer(applicationReference: string, reviewerUserId: string, sectionFocus?: string) {
    const app = await this.db.recruitmentApplication.findUnique({
      where: { publicReference: applicationReference },
    });
    if (!app) throw new RecruitmentError("Application not found.");

    const assignmentRef = `RAS-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return this.db.recruitmentReviewAssignment.create({
      data: {
        publicReference: assignmentRef,
        applicationId: app.id,
        reviewerUserId,
        sectionFocus: sectionFocus || "GENERAL",
        status: "PENDING",
      },
    });
  }

  async requestInformation(applicationReference: string, _notes: string) {
    void _notes;
    return this.db.recruitmentApplication.update({
      where: { publicReference: applicationReference },
      data: {
        currentStage: "INFORMATION_REQUESTED",
        optimisticVersion: { increment: 1 },
      },
    });
  }

  async progressApplication(applicationReference: string, targetStage: string) {
    return this.db.recruitmentApplication.update({
      where: { publicReference: applicationReference },
      data: {
        currentStage: targetStage,
        optimisticVersion: { increment: 1 },
      },
    });
  }

  async confirmIneligibility(applicationReference: string, reasonCode: string, humanReviewerUserId: string) {
    if (!humanReviewerUserId) throw new RecruitmentError("Human reviewer is required for ineligibility confirmation.");

    const app = await this.db.recruitmentApplication.findUnique({
      where: { publicReference: applicationReference },
    });
    if (!app) throw new RecruitmentError("Application not found.");

    const decisionRef = `DEC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    await this.db.recruitmentDecision.create({
      data: {
        publicReference: decisionRef,
        applicationId: app.id,
        reviewerUserId: humanReviewerUserId,
        decisionType: "CONFIRM_INELIGIBILITY",
        reasonCode,
        applicantFacingCategory: "INELIGIBLE",
        evidenceReference: `INELIGIBILITY-${Date.now()}`,
      },
    });

    return this.db.recruitmentApplication.update({
      where: { publicReference: applicationReference },
      data: {
        status: RecruitmentApplicationState.REJECTED,
        currentStage: "REJECTED_INELIGIBLE",
        rejectedAt: new Date(),
        optimisticVersion: { increment: 1 },
      },
    });
  }

  async rejectApplication(
    applicationReference: string,
    rejectionReasonCode: string,
    applicantFacingCategory: string,
    humanReviewerUserId: string
  ) {
    if (!humanReviewerUserId) throw new RecruitmentError("Human reviewer identity is required for all rejection decisions.");
    const safeApplicantFacingCategories = new Set([
      "NOT_SELECTED",
      "ROLE_REQUIREMENTS_NOT_MET",
      "WITHDRAWN_BY_APPLICANT",
      "POSITION_CLOSED",
      "INELIGIBLE",
    ]);
    if (!safeApplicantFacingCategories.has(applicantFacingCategory)) {
      throw new RecruitmentError("Rejection requires an approved applicant-facing reason category.");
    }

    const app = await this.db.recruitmentApplication.findUnique({
      where: { publicReference: applicationReference },
    });
    if (!app) throw new RecruitmentError("Application not found.");

    const decisionRef = `DEC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    await this.db.recruitmentDecision.create({
      data: {
        publicReference: decisionRef,
        applicationId: app.id,
        reviewerUserId: humanReviewerUserId,
        decisionType: "REJECT",
        reasonCode: rejectionReasonCode,
        applicantFacingCategory: applicantFacingCategory || "NOT_SELECTED",
        evidenceReference: `HUMAN_DECISION-${Date.now()}`,
      },
    });

    return this.db.recruitmentApplication.update({
      where: { publicReference: applicationReference },
      data: {
        status: RecruitmentApplicationState.REJECTED,
        currentStage: "REJECTED",
        rejectedAt: new Date(),
        optimisticVersion: { increment: 1 },
      },
    });
  }
}
