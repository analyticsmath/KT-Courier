/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { RecruitmentTrack, RecruitmentLocationPolicy, RecruitmentRequisitionStatus } from "@/types/db";
import { assertRecruitmentProductionReady } from "./production-readiness";
import { RecruitmentError } from "./errors";

export class RequisitionService {
  constructor(private readonly db: any) {}

  async createRequisition(input: {
    positionFamilyId: string;
    recruitmentTrack: RecruitmentTrack;
    requestedHeadcount: number;
    departmentCode?: string;
    hiringManagerUserId: string;
    requestedByUserId: string;
    locationPolicy: RecruitmentLocationPolicy;
    primaryLocation?: string;
    relationshipClassification: string;
    compensationCurrency?: string;
    compensationMinimum?: number;
    compensationMaximum?: number;
    businessJustification: string;
    operationId: string;
    requestHash: string;
  }) {
    const publicReference = `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return this.db.recruitmentRequisition.create({
      data: {
        publicReference,
        positionFamilyId: input.positionFamilyId,
        recruitmentTrack: input.recruitmentTrack,
        requestedHeadcount: input.requestedHeadcount,
        departmentCode: input.departmentCode || null,
        hiringManagerUserId: input.hiringManagerUserId,
        requestedByUserId: input.requestedByUserId,
        locationPolicy: input.locationPolicy,
        primaryLocation: input.primaryLocation || null,
        relationshipClassification: input.relationshipClassification,
        compensationCurrency: input.compensationCurrency || "ZAR",
        compensationMinimum: input.compensationMinimum ?? null,
        compensationMaximum: input.compensationMaximum ?? null,
        businessJustification: input.businessJustification,
        status: RecruitmentRequisitionStatus.DRAFT,
        operationId: input.operationId,
        requestHash: input.requestHash,
      },
    });
  }

  async submitRequisition(reference: string) {
    return this.db.recruitmentRequisition.update({
      where: { publicReference: reference },
      data: {
        status: RecruitmentRequisitionStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });
  }

  async approveRequisition(reference: string, approverUserId: string) {
    const requisition = await this.db.recruitmentRequisition.findUnique({
      where: { publicReference: reference },
    });

    if (!requisition) throw new RecruitmentError("Requisition not found.");
    if (requisition.status === RecruitmentRequisitionStatus.DRAFT) {
      throw new RecruitmentError("Requisition must be UNDER_REVIEW before approval.");
    }

    return this.db.recruitmentRequisition.update({
      where: { publicReference: reference },
      data: {
        status: RecruitmentRequisitionStatus.APPROVED,
        approvedByUserId: approverUserId,
        approvedAt: new Date(),
      },
    });
  }

  async incrementFilledCount(reference: string) {
    const requisition = await this.db.recruitmentRequisition.findUnique({
      where: { publicReference: reference },
    });

    if (!requisition) throw new RecruitmentError("Requisition not found.");
    const currentFilled = requisition.filledHeadcount || 0;
    const approved = requisition.approvedHeadcount || 0;

    if (currentFilled >= approved) {
      throw new RecruitmentError("Filled headcount cannot exceed approved headcount.");
    }

    return this.db.recruitmentRequisition.update({
      where: { publicReference: reference },
      data: { filledHeadcount: currentFilled + 1 },
    });
  }

  async rejectRequisition(reference: string, rejectionReason: string) {
    return this.db.recruitmentRequisition.update({
      where: { publicReference: reference },
      data: {
        status: RecruitmentRequisitionStatus.REJECTED,
        rejectionReason,
        rejectedAt: new Date(),
      },
    });
  }

  async cancelRequisition(reference: string) {
    assertRecruitmentProductionReady();
    return this.db.recruitmentRequisition.update({
      where: { publicReference: reference },
      data: { status: RecruitmentRequisitionStatus.CANCELLED, closedAt: new Date() },
    });
  }

  async getRequisition(reference: string) {
    return this.db.recruitmentRequisition.findUnique({
      where: { publicReference: reference },
      include: {
        positionFamily: true,
        openings: true,
      },
    });
  }

  async listRequisitions(filter?: { track?: RecruitmentTrack; status?: RecruitmentRequisitionStatus }) {
    const where: any = {};
    if (filter?.track) where.recruitmentTrack = filter.track;
    if (filter?.status) where.status = filter.status;
    return this.db.recruitmentRequisition.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }
}
