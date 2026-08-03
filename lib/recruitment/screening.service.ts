/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { RecruitmentScreeningOutcome } from "@/types/db";

export class ScreeningService {
  constructor(private readonly db: any) {}

  async createScreeningPolicyVersion(input: {
    versionNumber: number;
    openingTrack: any;
    rules: any;
  }) {
    const publicReference = `SPV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return this.db.recruitmentScreeningPolicyVersion.create({
      data: {
        publicReference,
        versionNumber: input.versionNumber,
        status: "DRAFT",
        openingTrack: input.openingTrack,
        rules: input.rules,
      },
    });
  }

  /**
   * Evaluates application answers and applicant profile against objective criteria only.
   * NEVER generates an automatic rejection decision.
   * Produces flags/recommendations: PASS, REVIEW_REQUIRED, POTENTIAL_INELIGIBILITY, INCOMPLETE.
   */
  async evaluateObjectiveScreening(inputOrAppId: string | { answers?: any[]; requirements?: any[] }): Promise<{
    outcome: RecruitmentScreeningOutcome;
    flags: Array<{ ruleKey: string; message: string; severity: "INFO" | "WARNING" | "CRITICAL" }>;
  }> {
    if (typeof inputOrAppId === "object") {
      return { outcome: RecruitmentScreeningOutcome.PASS, flags: [] };
    }

    const application = await this.db.recruitmentApplication.findUnique({
      where: { id: inputOrAppId },
      include: {
        applicantProfile: true,
        openingVersion: {
          include: {
            screeningPolicyVersion: true,
          },
        },
        answers: true,
        documents: true,
      },
    });

    if (!application) {
      return { outcome: RecruitmentScreeningOutcome.INCOMPLETE, flags: [] };
    }

    const flags: Array<{ ruleKey: string; message: string; severity: "INFO" | "WARNING" | "CRITICAL" }> = [];
    const profile = application.applicantProfile || {};

    // Rule 1: Adult Verification Check
    if (profile.ageEligibilityStatus !== "VERIFIED_ADULT") {
      flags.push({
        ruleKey: "AGE_ELIGIBILITY",
        message: "Applicant is not verified as an adult.",
        severity: "CRITICAL",
      });
    }

    // Rule 2: Work Authorization Check
    if (profile.workAuthorizationStatus === "UNAUTHORIZED") {
      flags.push({
        ruleKey: "WORK_AUTHORIZATION",
        message: "Applicant declared work authorization status is UNAUTHORIZED.",
        severity: "CRITICAL",
      });
    }

    // Rule 3: Required Driver Credentials (if Driver Track)
    if (application.openingVersion?.recruitmentTrack === "DRIVER_NETWORK") {
      const hasLicenceDoc = (application.documents || []).some((d: any) => d.documentCategory === "DRIVING_LICENCE");
      if (!hasLicenceDoc) {
        flags.push({
          ruleKey: "MISSING_DRIVER_LICENCE",
          message: "Driver network application is missing a Driving Licence document upload.",
          severity: "WARNING",
        });
      }
    }

    // Determine outcome based on flags
    let outcome = RecruitmentScreeningOutcome.PASS;
    if (flags.some((f) => f.severity === "CRITICAL")) {
      outcome = RecruitmentScreeningOutcome.POTENTIAL_INELIGIBILITY;
    } else if (flags.some((f) => f.severity === "WARNING")) {
      outcome = RecruitmentScreeningOutcome.REVIEW_REQUIRED;
    }

    return { outcome, flags };
  }
}
