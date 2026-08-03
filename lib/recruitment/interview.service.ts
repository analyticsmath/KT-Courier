/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { RecruitmentInterviewType, RecruitmentInterviewStatus, RecruitmentScorecardDecision } from "@/types/db";
import { RecruitmentError } from "./errors";

export class InterviewService {
  constructor(private readonly db: any) {}

  async createInterviewPlan(input: {
    openingVersionId: string;
    interviewType: RecruitmentInterviewType;
    durationMinutes?: number;
    stageName?: string;
    scorecardVersionId?: string;
  }) {
    const publicReference = `IPN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return this.db.recruitmentInterviewPlan.create({
      data: {
        publicReference,
        openingVersionId: input.openingVersionId,
        interviewType: input.interviewType,
        stageName: input.stageName || "INTERVIEW_STAGE",
        durationMinutes: input.durationMinutes || 60,
        scorecardVersionId: input.scorecardVersionId || null,
        status: "ACTIVE",
      },
    });
  }

  async createInterviewSlot(input: {
    openingId: string;
    startTime: Date;
    endTime: Date;
    locationOrUrl?: string;
    maxApplicants?: number;
  }) {
    const publicReference = `SLT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return this.db.recruitmentInterviewSlot.create({
      data: {
        publicReference,
        openingId: input.openingId,
        startTime: input.startTime,
        endTime: input.endTime,
        locationOrUrl: input.locationOrUrl || null,
        maxApplicants: input.maxApplicants || 1,
      },
    });
  }

  async scheduleInterview(input: {
    applicationId: string;
    interviewPlanId: string;
    slotId?: string;
    interviewType: RecruitmentInterviewType;
    scheduledAt?: Date;
    locationOrUrl?: string;
    panelUserIds?: string[];
  }) {
    const publicReference = `INT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const interview = await this.db.recruitmentInterview.create({
      data: {
        publicReference,
        applicationId: input.applicationId,
        interviewPlanId: input.interviewPlanId,
        slotId: input.slotId || null,
        interviewType: input.interviewType,
        status: RecruitmentInterviewStatus.SCHEDULED,
        scheduledAt: input.scheduledAt || null,
        locationOrUrl: input.locationOrUrl || null,
      },
    });

    if (input.panelUserIds && input.panelUserIds.length > 0) {
      await Promise.all(
        input.panelUserIds.map((userId) =>
          this.db.recruitmentInterviewPanelMember.create({
            data: {
              interviewId: interview.id,
              interviewerUserId: userId,
              role: "PANEL_MEMBER",
            },
          })
        )
      );
    }

    if (input.slotId) {
      await this.db.recruitmentInterviewSlot.update({
        where: { id: input.slotId },
        data: { bookedCount: { increment: 1 } },
      });
    }

    return interview;
  }

  async submitScorecard(input: {
    interviewId: string;
    interviewerUserId: string;
    decision: RecruitmentScorecardDecision;
    structuredRatings: any;
    freeformEvidence: string;
  }) {
    const publicReference = `SCR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const scorecard = await this.db.recruitmentScorecard.create({
      data: {
        publicReference,
        interviewId: input.interviewId,
        interviewerUserId: input.interviewerUserId,
        decision: input.decision,
        structuredRatings: input.structuredRatings,
        freeformEvidence: input.freeformEvidence,
      },
    });

    // Check if panel is complete and set interview status to COMPLETED
    const panel = await this.db.recruitmentInterviewPanelMember.findMany({
      where: { interviewId: input.interviewId },
    });

    const scorecards = await this.db.recruitmentScorecard.findMany({
      where: { interviewId: input.interviewId },
    });

    if (panel.length === 0 || scorecards.length >= panel.length) {
      await this.db.recruitmentInterview.update({
        where: { id: input.interviewId },
        data: {
          status: RecruitmentInterviewStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    }

    return scorecard;
  }

  async listInterviewsForApplication(applicationId: string) {
    return this.db.recruitmentInterview.findMany({
      where: { applicationId },
      include: {
        slot: true,
        panelMembers: true,
        scorecards: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listInterviews(filter?: { openingId?: string; status?: string }) {
    const where: any = {};
    if (filter?.status) where.status = filter.status;
    return this.db.recruitmentInterview.findMany({
      where,
      include: {
        application: {
          include: { applicantProfile: true },
        },
        slot: true,
        panelMembers: true,
        scorecards: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getInterviewByReference(reference: string) {
    return this.db.recruitmentInterview.findUnique({
      where: { publicReference: reference },
      include: {
        application: {
          include: { applicantProfile: true },
        },
        slot: true,
        panelMembers: true,
        scorecards: true,
      },
    });
  }

  async selectSlot(interviewReference: string, slotReference: string, applicantProfileId: string) {
    const interview = await this.getInterviewByReference(interviewReference);
    if (!interview) throw new RecruitmentError("Interview not found.");
    if (interview.application.applicantProfileId !== applicantProfileId) {
      throw new RecruitmentError("Interview access denied for this applicant profile.");
    }

    const slot = await this.db.recruitmentInterviewSlot.findUnique({
      where: { publicReference: slotReference },
    });
    if (!slot) throw new RecruitmentError("Interview slot not found.");

    await this.db.recruitmentInterviewSlot.update({
      where: { id: slot.id },
      data: { bookedCount: { increment: 1 } },
    });

    return this.db.recruitmentInterview.update({
      where: { publicReference: interviewReference },
      data: {
        slotId: slot.id,
        scheduledAt: slot.startTime,
        locationOrUrl: slot.locationOrUrl,
        status: RecruitmentInterviewStatus.SCHEDULED,
      },
    });
  }

  async requestReschedule(interviewReference: string, reason: string, applicantProfileId: string) {
    const interview = await this.getInterviewByReference(interviewReference);
    if (!interview) throw new RecruitmentError("Interview not found.");
    if (interview.application.applicantProfileId !== applicantProfileId) {
      throw new RecruitmentError("Interview access denied for this applicant profile.");
    }

    return this.db.recruitmentInterview.update({
      where: { publicReference: interviewReference },
      data: {
        status: RecruitmentInterviewStatus.RESCHEDULE_REQUESTED,
        rescheduleReason: reason,
      },
    });
  }

  async completeInterview(reference: string, notes?: string) {
    return this.db.recruitmentInterview.update({
      where: { publicReference: reference },
      data: {
        status: RecruitmentInterviewStatus.COMPLETED,
        completedAt: new Date(),
        summaryNotes: notes || null,
      },
    });
  }

  async scheduleExistingInterview(reference: string, scheduledAt: Date, locationOrUrl?: string) {
    return this.db.recruitmentInterview.update({
      where: { publicReference: reference },
      data: { scheduledAt, locationOrUrl: locationOrUrl || null, status: RecruitmentInterviewStatus.SCHEDULED },
    });
  }
}
