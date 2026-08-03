/* eslint-disable @typescript-eslint/no-explicit-any -- focused fake repositories exercise DB-free privacy, retention & EE boundaries. */
import { beforeEach, describe, expect, it } from "vitest";
import { PrivacyRetentionService } from "@/lib/recruitment/privacy-retention.service";
import { EmploymentEquityService } from "@/lib/recruitment/employment-equity.service";
import { RecruitmentDataRequestType, RecruitmentConsentType, RecruitmentConsentStatus } from "@/types/db";
import { RecruitmentProductionLockError } from "@/lib/recruitment/production-readiness";

describe("Phase 26 Privacy, Retention, Applicant Rights and Employment Equity", () => {
  let db: any;
  let privacyService: PrivacyRetentionService;
  let eeService: EmploymentEquityService;

  beforeEach(() => {
    db = {
      recruitmentPrivacyNoticeVersion: {
        create: async ({ data }: any) => ({ id: "pnv-1", ...data }),
        findMany: async () => [{ id: "pnv-1", versionNumber: 1 }],
      },
      recruitmentConsentRecord: {
        create: async ({ data }: any) => ({ id: "cr-1", ...data }),
        findMany: async () => [{ id: "cr-1", consentType: RecruitmentConsentType.APPLICATION_PROCESSING_NOTICE_ACKNOWLEDGEMENT }],
      },
      recruitmentApplicantDataRequest: {
        create: async ({ data }: any) => ({ id: "sdr-1", ...data }),
        findMany: async () => [{ id: "sdr-1", requestType: "ACCESS" }],
      },
      recruitmentRetentionPolicyVersion: {
        create: async ({ data }: any) => ({ id: "rpv-1", ...data }),
        findMany: async () => [{ id: "rpv-1", versionNumber: 1 }],
      },
      recruitmentApplication: {
        update: async ({ data }: any) => data,
      },
      recruitmentEmploymentEquityDeclaration: {
        create: async ({ data }: any) => ({ id: "ee-1", ...data }),
        findUnique: async ({ where }: any) => {
          if (where.applicantProfileId === "prof-ee-1") {
            return {
              id: "ee-1",
              applicantProfileId: "prof-ee-1",
              genderCategory: "FEMALE",
              raceCategory: "AFRICAN",
              disabilityStatus: "NONE",
            };
          }
          return null;
        },
      },
      recruitmentEmploymentEquityConfiguration: {
        findFirst: async () => ({
          useMode: "REPORTING_ONLY",
          employerDesignation: "UNKNOWN",
          selectionSupportEnabled: false,
        }),
      },
    };
    privacyService = new PrivacyRetentionService(db);
    eeService = new EmploymentEquityService(db);
  });

  describe("Privacy & Applicant Rights Invariants", () => {
    it("supports all required data request types (ACCESS, CORRECTION, DELETION, RESTRICTION, CONSENT_WITHDRAWAL, TALENT_POOL_WITHDRAWAL)", async () => {
      const types: RecruitmentDataRequestType[] = [
        RecruitmentDataRequestType.ACCESS,
        RecruitmentDataRequestType.CORRECTION,
        RecruitmentDataRequestType.DELETION,
        RecruitmentDataRequestType.RESTRICTION,
        RecruitmentDataRequestType.CONSENT_WITHDRAWAL,
        RecruitmentDataRequestType.TALENT_POOL_WITHDRAWAL,
      ];

      for (const requestType of types) {
        const req = await privacyService.createDataRequest({
          applicantProfileId: "prof-1",
          requestType,
          operationId: `OP-${requestType}`,
          requestHash: `HASH-${requestType}`,
        });
        expect(req.requestType).toBe(requestType);
        expect(req.status).toBe("SUBMITTED");
      }
    });

    it("records applicant consent with type and version binding", async () => {
      const consent = await privacyService.recordConsent({
        applicantProfileId: "prof-1",
        consentType: RecruitmentConsentType.APPLICATION_PROCESSING_NOTICE_ACKNOWLEDGEMENT,
        noticeVersionId: "pnv-1",
        status: RecruitmentConsentStatus.ACCEPTED,
        operationId: "OP-C1",
        requestHash: "HASH-C1",
      });

      expect(consent.consentType).toBe(RecruitmentConsentType.APPLICATION_PROCESSING_NOTICE_ACKNOWLEDGEMENT);
      expect(consent.status).toBe("ACCEPTED");
      expect(consent.acceptedAt).toBeDefined();
    });

    it("applies legal hold to block automated deletion", async () => {
      const result = await privacyService.toggleLegalHold("app-1", true, "LITIGATION_HOLD");
      expect(result.legalHoldActive).toBe(true);
      expect(result.legalHoldReason).toBe("LITIGATION_HOLD");
    });

    it("locks production retention purge before Phase 26.5", async () => {
      await expect(privacyService.executeRetentionPurge()).rejects.toBeInstanceOf(RecruitmentProductionLockError);
    });
  });

  describe("Employment Equity Segregation & Reporting Invariants", () => {
    it("uses a segregated repository/model for EE data", async () => {
      const decl = await eeService.saveDeclaration({
        applicantProfileId: "prof-ee-1",
        genderCategory: "FEMALE",
        raceCategory: "AFRICAN",
        disabilityStatus: "NONE",
      });

      expect(decl.applicantProfileId).toBe("prof-ee-1");
    });

    it("denies ordinary recruiters and interviewers access to raw EE declarations", async () => {
      await expect(
        eeService.getRawDeclarationForReviewer("prof-ee-1", {
          role: "INTERVIEWER",
          permissions: ["recruitment_interview"],
        })
      ).rejects.toThrow("Raw employment-equity declarations are restricted to compliance personnel.");
    });

    it("defaults EE mode to REPORTING_ONLY and employer designation to UNKNOWN", async () => {
      const config = await eeService.getConfiguration();
      expect(config.useMode).toBe("REPORTING_ONLY");
      expect(config.employerDesignation).toBe("UNKNOWN");
      expect(config.selectionSupportEnabled).toBe(false);
    });

    it("fails closed when LAWFUL_SELECTION_SUPPORT is requested without an effective approved policy", async () => {
      await expect(
        eeService.evaluateSelectionSupport("prof-ee-1", "job-1")
      ).rejects.toThrow("Lawful selection support is disabled without an approved effective policy.");
    });
  });
});
