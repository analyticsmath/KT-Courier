/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import {
  RecruitmentOpeningStatus,
  RecruitmentVersionStatus,
  RecruitmentTrack,
  RecruitmentLocationPolicy,
  RecruitmentCompensationDisplayPolicy,
} from "@/types/db";
import { assertRecruitmentProductionReady } from "./production-readiness";
import { RecruitmentError } from "./errors";

export class OpeningService {
  constructor(private readonly db: any) {}

  async createOpening(input: {
    requisitionId: string;
    positionFamilyId: string;
  }) {
    const publicReference = `OPN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return this.db.recruitmentOpening.create({
      data: {
        publicReference,
        requisitionId: input.requisitionId,
        positionFamilyId: input.positionFamilyId,
        status: RecruitmentOpeningStatus.DRAFT,
      },
    });
  }

  async createOpeningVersion(input: {
    openingId: string;
    versionNumber: number;
    publicTitle: string;
    publicSummary: string;
    responsibilities: string;
    essentialCriteria: string;
    desirableCriteria: string;
    recruitmentTrack: RecruitmentTrack;
    relationshipClassification: string;
    locationPolicy: RecruitmentLocationPolicy;
    primaryLocation?: string;
    serviceRegions?: any;
    scheduleDescription?: string;
    compensationDisplayPolicy?: RecruitmentCompensationDisplayPolicy;
    compensationMinimum?: number;
    compensationMaximum?: number;
    currency?: string;
    applicationOpensAt?: Date;
    applicationClosesAt?: Date;
    applicationFormVersionId: string;
    screeningPolicyVersionId: string;
    evaluationRubricVersionId: string;
    backgroundCheckPolicyVersionId: string;
    privacyNoticeVersionId: string;
    retentionPolicyVersionId: string;
    employmentEquityPolicyReference?: string;
  }) {
    const publicReference = `OPNV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return this.db.recruitmentOpeningVersion.create({
      data: {
        publicReference,
        openingId: input.openingId,
        versionNumber: input.versionNumber,
        status: RecruitmentVersionStatus.DRAFT,
        publicTitle: input.publicTitle,
        publicSummary: input.publicSummary,
        responsibilities: input.responsibilities,
        essentialCriteria: input.essentialCriteria,
        desirableCriteria: input.desirableCriteria,
        recruitmentTrack: input.recruitmentTrack,
        relationshipClassification: input.relationshipClassification,
        locationPolicy: input.locationPolicy,
        primaryLocation: input.primaryLocation || null,
        serviceRegions: input.serviceRegions || null,
        scheduleDescription: input.scheduleDescription || null,
        compensationDisplayPolicy: input.compensationDisplayPolicy || RecruitmentCompensationDisplayPolicy.HIDDEN,
        compensationMinimum: input.compensationMinimum ?? null,
        compensationMaximum: input.compensationMaximum ?? null,
        currency: input.currency || "ZAR",
        applicationOpensAt: input.applicationOpensAt || null,
        applicationClosesAt: input.applicationClosesAt || null,
        applicationFormVersionId: input.applicationFormVersionId,
        screeningPolicyVersionId: input.screeningPolicyVersionId,
        evaluationRubricVersionId: input.evaluationRubricVersionId,
        backgroundCheckPolicyVersionId: input.backgroundCheckPolicyVersionId,
        privacyNoticeVersionId: input.privacyNoticeVersionId,
        retentionPolicyVersionId: input.retentionPolicyVersionId,
        employmentEquityPolicyReference: input.employmentEquityPolicyReference || null,
      },
    });
  }

  async updateOpeningVersion(openingReference: string, updates: any) {
    const opening = await this.db.recruitmentOpening.findUnique({
      where: { publicReference: openingReference },
      include: { currentVersion: true },
    });

    if (!opening) throw new RecruitmentError("Opening not found.");
    if (opening.status === RecruitmentOpeningStatus.PUBLISHED || opening.currentVersion?.isFrozen) {
      throw new RecruitmentError("Published opening versions are immutable and cannot be mutated in place.");
    }

    return this.db.recruitmentOpeningVersion.update({
      where: { id: opening.latestVersionId },
      data: updates,
    });
  }

  async approveOpeningVersion(versionReference: string, approverUserId: string) {
    return this.db.recruitmentOpeningVersion.update({
      where: { publicReference: versionReference },
      data: {
        status: RecruitmentVersionStatus.APPROVED,
        approvedByUserId: approverUserId,
        approvedAt: new Date(),
      },
    });
  }

  async submitOpening(reference: string) {
    assertRecruitmentProductionReady();
    return this.db.recruitmentOpening.update({
      where: { publicReference: reference },
      data: { status: RecruitmentOpeningStatus.UNDER_REVIEW },
    });
  }

  async publishOpening(reference: string) {
    const opening = await this.db.recruitmentOpening.findUnique({
      where: { publicReference: reference },
    });

    if (!opening) throw new RecruitmentError("Opening not found.");
    if (opening.status === RecruitmentOpeningStatus.CANCELLED) {
      throw new RecruitmentError("Cannot publish a cancelled opening.");
    }

    assertRecruitmentProductionReady();
    return this.db.recruitmentOpening.update({
      where: { publicReference: reference },
      data: { status: RecruitmentOpeningStatus.PUBLISHED },
    });
  }

  async pauseOpening(reference: string) {
    assertRecruitmentProductionReady();
    return this.db.recruitmentOpening.update({ where: { publicReference: reference }, data: { status: RecruitmentOpeningStatus.PAUSED } });
  }

  async closeOpening(reference: string) {
    assertRecruitmentProductionReady();
    return this.db.recruitmentOpening.update({ where: { publicReference: reference }, data: { status: RecruitmentOpeningStatus.CLOSED } });
  }

  async cancelOpening(reference: string) {
    assertRecruitmentProductionReady();
    return this.db.recruitmentOpening.update({ where: { publicReference: reference }, data: { status: RecruitmentOpeningStatus.CANCELLED } });
  }

  async publishOpeningVersion(openingReference: string, versionReference: string) {
    assertRecruitmentProductionReady();

    const version = await this.db.recruitmentOpeningVersion.update({
      where: { publicReference: versionReference },
      data: {
        status: RecruitmentVersionStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    await this.db.recruitmentOpening.update({
      where: { publicReference: openingReference },
      data: {
        status: RecruitmentOpeningStatus.PUBLISHED,
        currentVersionId: version.id,
      },
    });

    return version;
  }

  async getPublicOpenings(filter?: { track?: RecruitmentTrack; location?: string }) {
    const where: any = {
      status: RecruitmentOpeningStatus.PUBLISHED,
    };
    if (filter?.track) {
      where.positionFamily = { recruitmentTrack: filter.track };
    }

    const openings = await this.db.recruitmentOpening.findMany({
      where,
      include: {
        currentVersion: true,
        positionFamily: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform into safe public DTOs
    return openings.map((op: any) => {
      const v = op.currentVersion;
      return {
        openingReference: op.publicReference,
        versionReference: v?.publicReference,
        title: v?.publicTitle,
        summary: v?.publicSummary,
        responsibilities: v?.responsibilities,
        essentialCriteria: v?.essentialCriteria,
        desirableCriteria: v?.desirableCriteria,
        track: v?.recruitmentTrack,
        relationshipClassification: v?.relationshipClassification,
        locationPolicy: v?.locationPolicy,
        primaryLocation: v?.primaryLocation,
        serviceRegions: v?.serviceRegions,
        scheduleDescription: v?.scheduleDescription,
        compensationDisplayPolicy: v?.compensationDisplayPolicy,
        compensationMinimum: v?.compensationDisplayPolicy !== "HIDDEN" ? v?.compensationMinimum : null,
        compensationMaximum: v?.compensationDisplayPolicy !== "HIDDEN" ? v?.compensationMaximum : null,
        currency: v?.currency,
        applicationClosesAt: v?.applicationClosesAt,
        noFeeStatement: "KT Couriers never charges applicants any application, screening, or placement fee.",
        accessibilityStatement: "KT Couriers is committed to providing reasonable accommodations to all applicants.",
      };
    });
  }

  async getOpeningByReference(reference: string) {
    return this.db.recruitmentOpening.findUnique({
      where: { publicReference: reference },
      include: {
        currentVersion: true,
        versions: true,
        positionFamily: true,
        requisition: true,
      },
    });
  }
}
