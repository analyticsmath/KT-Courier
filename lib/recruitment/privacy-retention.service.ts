/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import {
  RecruitmentConsentType,
  RecruitmentConsentStatus,
  RecruitmentVersionStatus,
  RecruitmentDataRequestType,
  RecruitmentDataRequestStatus,
} from "@/types/db";
import { assertRecruitmentProductionReady } from "./production-readiness";

export class PrivacyRetentionService {
  constructor(private readonly db: any) {}

  async createPrivacyNoticeVersion(input: {
    versionNumber: number;
    purpose: string;
    dataCategories: any;
    recipientCategories: any;
    retentionSummary: string;
    crossBorderTransferSummary?: string;
    applicantRights: string;
    complaintInformation: string;
  }) {
    const publicReference = `PNV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return this.db.recruitmentPrivacyNoticeVersion.create({
      data: {
        publicReference,
        versionNumber: input.versionNumber,
        status: RecruitmentVersionStatus.DRAFT,
        purpose: input.purpose,
        dataCategories: input.dataCategories,
        recipientCategories: input.recipientCategories,
        retentionSummary: input.retentionSummary,
        crossBorderTransferSummary: input.crossBorderTransferSummary || null,
        applicantRights: input.applicantRights,
        complaintInformation: input.complaintInformation,
      },
    });
  }

  async recordConsent(input: {
    applicantProfileId: string;
    applicationId?: string;
    consentType: RecruitmentConsentType;
    noticeVersionId?: string;
    status: RecruitmentConsentStatus;
    evidence?: any;
    operationId: string;
    requestHash: string;
  }) {
    return this.db.recruitmentConsentRecord.create({
      data: {
        applicantProfileId: input.applicantProfileId,
        applicationId: input.applicationId || null,
        consentType: input.consentType,
        noticeVersionId: input.noticeVersionId || null,
        status: input.status,
        acceptedAt: input.status === RecruitmentConsentStatus.ACCEPTED ? new Date() : null,
        evidence: input.evidence || null,
        operationId: input.operationId,
        requestHash: input.requestHash,
      },
    });
  }

  async createDataRequest(input: {
    applicantProfileId: string;
    applicationId?: string;
    requestType: RecruitmentDataRequestType;
    operationId: string;
    requestHash: string;
  }) {
    const publicReference = `SDR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return this.db.recruitmentApplicantDataRequest.create({
      data: {
        publicReference,
        applicantProfileId: input.applicantProfileId,
        applicationId: input.applicationId || null,
        requestType: input.requestType,
        status: RecruitmentDataRequestStatus.SUBMITTED,
        operationId: input.operationId,
        requestHash: input.requestHash,
      },
    });
  }

  async createRetentionPolicyVersion(input: {
    versionNumber: number;
    draftApplicationRetentionDays?: number;
    unsuccessfulApplicationRetentionDays?: number;
    withdrawnApplicationRetentionDays?: number;
    successfulApplicationRecruitmentRetentionDays?: number;
    talentPoolRetentionDays?: number;
    checkEvidenceRetentionDays?: number;
    auditRetentionDays?: number;
  }) {
    const publicReference = `RPV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return this.db.recruitmentRetentionPolicyVersion.create({
      data: {
        publicReference,
        versionNumber: input.versionNumber,
        status: RecruitmentVersionStatus.DRAFT,
        draftApplicationRetentionDays: input.draftApplicationRetentionDays ?? 30,
        unsuccessfulApplicationRetentionDays: input.unsuccessfulApplicationRetentionDays ?? 365,
        withdrawnApplicationRetentionDays: input.withdrawnApplicationRetentionDays ?? 90,
        successfulApplicationRecruitmentRetentionDays: input.successfulApplicationRecruitmentRetentionDays ?? 1825,
        talentPoolRetentionDays: input.talentPoolRetentionDays ?? 365,
        checkEvidenceRetentionDays: input.checkEvidenceRetentionDays ?? 180,
        auditRetentionDays: input.auditRetentionDays ?? 2555,
      },
    });
  }

  async listPrivacyNotices() {
    return this.db.recruitmentPrivacyNoticeVersion.findMany({
      orderBy: { versionNumber: "desc" },
    });
  }

  async listConsents(applicantProfileId?: string) {
    const where: any = {};
    if (applicantProfileId) where.applicantProfileId = applicantProfileId;
    return this.db.recruitmentConsentRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async listDataRequests(applicantProfileId?: string) {
    const where: any = {};
    if (applicantProfileId) where.applicantProfileId = applicantProfileId;
    return this.db.recruitmentApplicantDataRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async listRetentionPolicies() {
    return this.db.recruitmentRetentionPolicyVersion.findMany({
      orderBy: { versionNumber: "desc" },
    });
  }

  async toggleLegalHold(applicationId: string, hold: boolean, reason?: string) {
    return this.db.recruitmentApplication.update({
      where: { id: applicationId },
      data: {
        legalHoldActive: hold,
        legalHoldReason: hold ? reason || "LEGAL_HOLD_APPLIED" : null,
      },
    });
  }

  async executeRetentionPurge() {
    assertRecruitmentProductionReady();
    // Production retention purge blocked before Phase 26.5
    return { purgedCount: 0, status: "BLOCKED_BY_PRODUCTION_LOCK" };
  }
}

