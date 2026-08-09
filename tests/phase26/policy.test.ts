import { describe, it, expect, beforeEach } from "vitest";
import { BackgroundCheckService } from "../../lib/recruitment/background-check.service";
import { RecruitmentCheckType } from "../../types/db";
import { RecruitmentCreditCheckNotAuthorizedError } from "../../lib/recruitment/errors";
import { ScreeningService } from "../../lib/recruitment/screening.service";

describe("Phase 26 — Recruitment Policy & Screening Unit Tests", () => {
  let mockDb: {
    recruitmentApplication: { findUnique: () => Promise<unknown> };
    recruitmentCheckCase: { create: (data: { data: Record<string, unknown> }) => Promise<Record<string, unknown>> };
    recruitmentBackgroundCheckPolicyVersion: { create: (data: { data: Record<string, unknown> }) => Promise<Record<string, unknown>> };
  };

  beforeEach(() => {
    mockDb = {
      recruitmentApplication: {
        findUnique: async () => ({
          id: "app-1",
          applicantProfileId: "prof-1",
          applicantProfile: {
            ageEligibilityStatus: "VERIFIED_ADULT",
            workAuthorizationStatus: "CITIZEN",
          },
          openingVersion: {
            recruitmentTrack: "INTERNAL_EMPLOYEE",
            relationshipClassification: "GENERAL_EMPLOYEE",
            publicTitle: "Customer Support Agent",
          },
          documents: [],
          answers: [],
        }),
      },
      recruitmentCheckCase: {
        create: async (data) => ({ id: "check-1", ...data.data }),
      },
      recruitmentBackgroundCheckPolicyVersion: {
        create: async (data) => ({ id: "policy-1", ...data.data }),
      },
    };
  });

  it("blocks credit checks for non-finance / non-cash roles with RecruitmentCreditCheckNotAuthorizedError", async () => {
    const bgService = new BackgroundCheckService(mockDb);

    await expect(
      bgService.initiateCheckCase({
        applicationId: "app-1",
        checkType: RecruitmentCheckType.ROLE_RELATED_CREDIT,
        policyVersionId: "policy-1",
        operationId: "op-1",
        requestHash: "hash-1",
      })
    ).rejects.toThrow(RecruitmentCreditCheckNotAuthorizedError);
  });

  it("evaluates objective screening rules and produces PASS for valid adult citizen applicants", async () => {
    const screeningService = new ScreeningService(mockDb);
    const result = await screeningService.evaluateObjectiveScreening("app-1");

    expect(result.outcome).toBe("PASS");
    expect(result.flags.length).toBe(0);
  });
});
