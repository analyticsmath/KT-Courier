/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { RecruitmentFraudOutcome } from "@/types/db";

export class RecruitmentFraudService {
  constructor(private readonly db: any) {}

  async evaluateApplicationFraud(input: { applicationId: string; signals?: any[] }): Promise<{
    outcome: RecruitmentFraudOutcome;
    cases: any[];
  }> {
    if (input.signals && input.signals.length > 0) {
      return { outcome: RecruitmentFraudOutcome.REVIEW, cases: [] };
    }
    return this.evaluateFraudForApplication(input.applicationId);
  }

  async evaluateFraudForApplication(applicationId: string): Promise<{
    outcome: RecruitmentFraudOutcome;
    cases: any[];
  }> {
    const application = await this.db.recruitmentApplication.findUnique({
      where: { id: applicationId },
      include: {
        applicantProfile: true,
        documents: true,
      },
    });

    if (!application) return { outcome: RecruitmentFraudOutcome.PASS, cases: [] };

    const detectedCases: any[] = [];

    // Fraud Check 1: Duplicate active applicant accounts
    const duplicateProfile = await this.db.recruitmentApplicantProfile.findFirst({
      where: {
        primaryEmailReference: application.applicantProfile?.primaryEmailReference,
        id: { not: application.applicantProfileId },
      },
    });

    if (duplicateProfile) {
      detectedCases.push({
        fraudCheckType: "DUPLICATE_APPLICANT_IDENTITY",
        outcome: RecruitmentFraudOutcome.REVIEW,
        reasonCode: "DUPLICATE_IDENTITY_EMAIL",
        safeSummary: "Multiple applicant profiles detected for the same email reference.",
      });
    }

    // Persist detected cases
    const createdCases = await Promise.all(
      detectedCases.map((c) =>
        this.db.recruitmentFraudCase.create({
          data: {
            publicReference: `FRD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            applicationId,
            fraudCheckType: c.fraudCheckType,
            outcome: c.outcome,
            reasonCode: c.reasonCode,
            safeSummary: c.safeSummary,
          },
        })
      )
    );

    let finalOutcome = RecruitmentFraudOutcome.PASS;
    if (createdCases.some((c: any) => c.outcome === RecruitmentFraudOutcome.BLOCK_OFFER)) {
      finalOutcome = RecruitmentFraudOutcome.BLOCK_OFFER;
    } else if (createdCases.some((c: any) => c.outcome === RecruitmentFraudOutcome.REVIEW)) {
      finalOutcome = RecruitmentFraudOutcome.REVIEW;
    }

    return { outcome: finalOutcome, cases: createdCases };
  }

  async listFraudCases() {
    return this.db.recruitmentFraudCase.findMany({
      include: {
        application: {
          include: { applicantProfile: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getFraudCaseByReference(reference: string) {
    return this.db.recruitmentFraudCase.findUnique({
      where: { publicReference: reference },
      include: {
        application: {
          include: { applicantProfile: true },
        },
      },
    });
  }
}
