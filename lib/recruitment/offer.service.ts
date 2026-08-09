/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import {
  RecruitmentOfferStatus,
  RecruitmentVersionStatus,
  RecruitmentApplicationState,
  RecruitmentTrack,
} from "@/types/db";
import { assertRecruitmentProductionReady } from "./production-readiness";
import { RecruitmentHeadcountExceededError, RecruitmentError } from "./errors";

export class OfferService {
  constructor(private readonly db: any) {}

  async createOffer(input: {
    requisitionId?: string;
    applicationId: string;
    roleTitle?: string;
    operationId?: string;
    requestHash?: string;
  }) {
    if (input.requisitionId) {
      const req = await this.db.recruitmentRequisition.findUnique({
        where: { publicReference: input.requisitionId },
      });
      if (req && (req.filledHeadcount || 0) >= (req.approvedHeadcount || 0)) {
        throw new RecruitmentError("Requisition approved headcount limit reached.");
      }
    }

    const publicReference = `OFR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return this.db.recruitmentOffer.create({
      data: {
        publicReference,
        applicationId: input.applicationId,
        status: RecruitmentOfferStatus.DRAFT,
      },
    });
  }

  async createOfferVersion(input: {
    offerId: string;
    versionNumber: number;
    roleTitle: string;
    recruitmentTrack: RecruitmentTrack;
    relationshipClassification: string;
    departmentCode?: string;
    location?: string;
    startDate?: Date;
    compensationCurrency?: string;
    compensationAmount?: number;
    compensationPeriod?: string;
    conditions: any;
    expiryAt: Date;
    documentReference?: string;
    termsHash?: string;
  }) {
    const publicReference = `OFV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return this.db.recruitmentOfferVersion.create({
      data: {
        publicReference,
        offerId: input.offerId,
        versionNumber: input.versionNumber,
        status: RecruitmentVersionStatus.DRAFT,
        roleTitle: input.roleTitle,
        recruitmentTrack: input.recruitmentTrack,
        relationshipClassification: input.relationshipClassification,
        departmentCode: input.departmentCode || null,
        location: input.location || null,
        startDate: input.startDate || null,
        compensationCurrency: input.compensationCurrency || "ZAR",
        compensationAmount: input.compensationAmount ?? null,
        compensationPeriod: input.compensationPeriod || "MONTHLY",
        conditions: input.conditions,
        expiryAt: input.expiryAt,
        documentReference: input.documentReference || null,
        termsHash: input.termsHash || `HASH-${Date.now()}`,
      },
    });
  }

  async approveOfferVersion(versionReference: string, approverUserId: string) {
    return this.db.recruitmentOfferVersion.update({
      where: { publicReference: versionReference },
      data: {
        status: RecruitmentVersionStatus.APPROVED,
        approvedByUserId: approverUserId,
        approvedAt: new Date(),
      },
    });
  }

  async submitOffer(reference: string) {
    assertRecruitmentProductionReady();
    return this.db.recruitmentOffer.update({
      where: { publicReference: reference },
      data: { status: RecruitmentOfferStatus.UNDER_APPROVAL },
    });
  }

  async issueOffer(offerReference: string, versionReference: string) {
    assertRecruitmentProductionReady();

    const offer = await this.db.recruitmentOffer.findUnique({
      where: { publicReference: offerReference },
      include: {
        application: {
          include: {
            opening: {
              include: {
                requisition: true,
              },
            },
          },
        },
      },
    });

    if (!offer) throw new RecruitmentError("Offer not found.");

    // Check requisition headcount limits
    const requisition = offer.application?.opening?.requisition;
    if (requisition) {
      const acceptedCount = await this.db.recruitmentApplication.count({
        where: {
          openingId: offer.application.openingId,
          status: {
            in: [RecruitmentApplicationState.OFFER_ACCEPTED, RecruitmentApplicationState.ONBOARDING_HANDOFF, RecruitmentApplicationState.COMPLETED],
          },
        },
      });

      if (acceptedCount >= requisition.requestedHeadcount) {
        throw new RecruitmentHeadcountExceededError();
      }
    }

    const version = await this.db.recruitmentOfferVersion.update({
      where: { publicReference: versionReference },
      data: {
        status: RecruitmentVersionStatus.PUBLISHED,
        issuedAt: new Date(),
      },
    });

    await this.db.recruitmentOffer.update({
      where: { publicReference: offerReference },
      data: {
        status: RecruitmentOfferStatus.ISSUED,
        currentVersionId: version.id,
      },
    });

    await this.db.recruitmentApplication.update({
      where: { id: offer.applicationId },
      data: {
        status: RecruitmentApplicationState.OFFERED,
        currentStage: "OFFERED",
        optimisticVersion: { increment: 1 },
      },
    });

    return version;
  }

  async acceptOffer(
    offerReferenceOrAppId: string,
    offerVersionReferenceOrId: string,
    expectedTermsHash?: string,
    _applicantProfileId?: string
  ) {
    void _applicantProfileId;
    const offerVersion = await this.db.recruitmentOfferVersion.findUnique({
      where: { id: offerVersionReferenceOrId },
      include: { offer: true },
    });

    if (offerVersion && expectedTermsHash && offerVersion.termsHash && offerVersion.termsHash !== expectedTermsHash) {
      throw new RecruitmentError("Offer terms hash mismatch.");
    }

    assertRecruitmentProductionReady();

    const offer = await this.db.recruitmentOffer.findUnique({
      where: { publicReference: offerReferenceOrAppId },
      include: { currentVersion: true },
    });

    if (!offer) throw new RecruitmentError("Offer not found.");
    if (offer.status !== RecruitmentOfferStatus.ISSUED) {
      throw new RecruitmentError("Only an issued offer may be accepted.");
    }
    if (!offerVersionReferenceOrId || offer.currentVersion?.publicReference !== offerVersionReferenceOrId) {
      throw new RecruitmentError("Offer acceptance must bind the exact issued offer version.");
    }

    await this.db.recruitmentOffer.update({
      where: { publicReference: offerReferenceOrAppId },
      data: { status: RecruitmentOfferStatus.ACCEPTED },
    });

    await this.db.recruitmentApplication.update({
      where: { id: offer.applicationId },
      data: {
        status: RecruitmentApplicationState.OFFER_ACCEPTED,
        currentStage: "OFFER_ACCEPTED",
        offerAcceptedAt: new Date(),
        optimisticVersion: { increment: 1 },
      },
    });

    return { status: "ACCEPTED", offerVersionReference: offerVersionReferenceOrId, acceptedAt: new Date() };
  }

  async declineOffer(offerReference: string) {
    const offer = await this.db.recruitmentOffer.findUnique({
      where: { publicReference: offerReference },
    });

    if (!offer) throw new RecruitmentError("Offer not found.");

    await this.db.recruitmentOffer.update({
      where: { publicReference: offerReference },
      data: { status: RecruitmentOfferStatus.DECLINED },
    });

    await this.db.recruitmentApplication.update({
      where: { id: offer.applicationId },
      data: {
        status: RecruitmentApplicationState.OFFER_DECLINED,
        currentStage: "OFFER_DECLINED",
        optimisticVersion: { increment: 1 },
      },
    });

    return { status: "DECLINED" };
  }

  async listOffers(filter?: { status?: string }) {
    const where: any = {};
    if (filter?.status) where.status = filter.status;

    return this.db.recruitmentOffer.findMany({
      where,
      include: {
        application: {
          include: { applicantProfile: true },
        },
        currentVersion: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOfferByReference(reference: string) {
    return this.db.recruitmentOffer.findUnique({
      where: { publicReference: reference },
      include: {
        application: {
          include: { applicantProfile: true },
        },
        currentVersion: true,
        versions: true,
      },
    });
  }

  async getOfferForApplication(applicationId: string) {
    return this.db.recruitmentOffer.findFirst({
      where: { applicationId },
      include: {
        currentVersion: true,
        versions: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async withdrawOffer(offerReference: string, reason: string) {
    const offer = await this.db.recruitmentOffer.findUnique({
      where: { publicReference: offerReference },
    });

    if (!offer) throw new RecruitmentError("Offer not found.");

    await this.db.recruitmentOffer.update({
      where: { publicReference: offerReference },
      data: {
        status: RecruitmentOfferStatus.WITHDRAWN,
        withdrawalReason: reason,
      },
    });

    await this.db.recruitmentApplication.update({
      where: { id: offer.applicationId },
      data: {
        status: RecruitmentApplicationState.REJECTED,
        currentStage: "OFFER_WITHDRAWN",
        optimisticVersion: { increment: 1 },
      },
    });

    return { status: "WITHDRAWN" };
  }
}
