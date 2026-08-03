/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { RecruitmentDecisionType, RecruitmentApplicationState } from "@/types/db";
import { RecruitmentError } from "./errors";
import { assertRecruitmentProductionReady } from "./production-readiness";

export class EvaluationService {
  constructor(private readonly db: any) {}

  async createRubricVersion(input: {
    versionNumber: number;
    recruitmentTrack: any;
    title: string;
    criteria: Array<{
      category: any;
      name: string;
      description: string;
      weight: number;
      displayOrder: number;
    }>;
  }) {
    const publicReference = `RUB-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return this.db.recruitmentEvaluationRubricVersion.create({
      data: {
        publicReference,
        versionNumber: input.versionNumber,
        status: "DRAFT",
        recruitmentTrack: input.recruitmentTrack,
        title: input.title,
        criteria: {
          create: input.criteria,
        },
      },
    });
  }

  async submitScorecard(input: {
    interviewId: string;
    interviewerUserId: string;
    criteriaScores: Array<{ criterionKey: string; score: number; notes?: string }>;
  }) {
    const interview = await this.db.recruitmentInterview.findUnique({
      where: { id: input.interviewId },
    });

    if (!interview) throw new RecruitmentError("Interview not found.");

    const assignment = interview.panelAssignments?.find(
      (a: any) => a.reviewerUserId === input.interviewerUserId
    );

    if (assignment?.hasConflictOfInterest) {
      throw new RecruitmentError("Conflicted interviewer cannot submit an evaluation scorecard.");
    }

    const publicReference = `SCR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return this.db.recruitmentScorecard.create({
      data: {
        publicReference,
        interviewId: input.interviewId,
        interviewerUserId: input.interviewerUserId,
        criteriaScores: input.criteriaScores,
        isSubmitted: true,
        submittedAt: new Date(),
      },
    });
  }

  /**
   * Records a human evaluation decision for an application.
   * Every rejection MUST be issued by an identified human reviewer with reason codes.
   */
  async recordDecision(input: {
    applicationId: string;
    decisionType: RecruitmentDecisionType;
    stage: string;
    reviewerUserId: string;
    rubricVersionId?: string;
    scorecardReference?: string;
    internalReasonCode: string;
    applicantFacingReasonCategory: string;
    safeInternalSummary?: string;
    operationId: string;
    requestHash: string;
  }) {
    assertRecruitmentProductionReady();

    if (!input.reviewerUserId) {
      throw new RecruitmentError("Human reviewer identity is required for consequential recruitment decisions.");
    }

    if (input.decisionType === RecruitmentDecisionType.REJECT) {
      if (!input.internalReasonCode || !input.applicantFacingReasonCategory) {
        throw new RecruitmentError("Rejection decisions require explicit internal reason codes and applicant-facing categories.");
      }
    }

    const publicReference = `DEC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const decision = await this.db.recruitmentDecision.create({
      data: {
        publicReference,
        applicationId: input.applicationId,
        decisionType: input.decisionType,
        stage: input.stage,
        reviewerUserId: input.reviewerUserId,
        rubricVersionId: input.rubricVersionId || null,
        scorecardReference: input.scorecardReference || null,
        internalReasonCode: input.internalReasonCode,
        applicantFacingReasonCategory: input.applicantFacingReasonCategory,
        safeInternalSummary: input.safeInternalSummary || null,
        operationId: input.operationId,
        requestHash: input.requestHash,
      },
    });

    // Update application state based on human decision
    let newStatus = RecruitmentApplicationState.HUMAN_REVIEW;
    if (input.decisionType === RecruitmentDecisionType.PROGRESS) {
      newStatus = RecruitmentApplicationState.INTERVIEW;
    } else if (input.decisionType === RecruitmentDecisionType.REJECT) {
      newStatus = RecruitmentApplicationState.REJECTED;
    } else if (input.decisionType === RecruitmentDecisionType.CONFIRM_INELIGIBILITY) {
      newStatus = RecruitmentApplicationState.INELIGIBLE_PENDING_CONFIRMATION;
    }

    await this.db.recruitmentApplication.update({
      where: { id: input.applicationId },
      data: {
        status: newStatus,
        currentStage: input.stage,
        currentDecisionId: decision.id,
        rejectedAt: input.decisionType === RecruitmentDecisionType.REJECT ? new Date() : undefined,
        optimisticVersion: { increment: 1 },
      },
    });

    return decision;
  }
}
