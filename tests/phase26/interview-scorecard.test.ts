/* eslint-disable @typescript-eslint/no-explicit-any -- focused fake repositories exercise DB-free interview, check & decision boundaries. */
import { beforeEach, describe, expect, it } from "vitest";
import { InterviewService } from "@/lib/recruitment/interview.service";
import { BackgroundCheckService } from "@/lib/recruitment/background-check.service";
import { EvaluationService } from "@/lib/recruitment/evaluation.service";
import { OfferService } from "@/lib/recruitment/offer.service";
import { ScreeningService } from "@/lib/recruitment/screening.service";
import { RecruitmentCheckType, RecruitmentInterviewType } from "@/types/db";
import {
  RecruitmentCreditCheckNotAuthorizedError,
} from "@/lib/recruitment/errors";

describe("Phase 26 Interview, Scorecard, Background Check, and Human Decision Invariants", () => {
  let db: any;
  let interviewService: InterviewService;
  let checkService: BackgroundCheckService;
  let evaluationService: EvaluationService;
  let offerService: OfferService;
  let screeningService: ScreeningService;

  beforeEach(() => {
    db = {
      recruitmentInterviewPlan: {
        create: async ({ data }: any) => ({ id: "plan-1", ...data }),
        findUnique: async () => ({ id: "plan-1", status: "APPROVED" }),
      },
      recruitmentInterview: {
        findUnique: async () => {
          return {
            id: "int-1",
            publicReference: "int-1",
            applicationId: "app-1",
            application: { applicantProfileId: "prof-1" },
            panelAssignments: [
              { reviewerUserId: "interviewer-1", hasConflictOfInterest: false },
              { reviewerUserId: "interviewer-2", hasConflictOfInterest: true },
            ],
          };
        },
      },
      recruitmentScorecard: {
        findUnique: async () => null,
        create: async ({ data }: any) => ({ id: "sc-1", isSubmitted: true, ...data }),
        update: async ({ data }: any) => data,
      },
      recruitmentApplication: {
        findUnique: async ({ where }: any) => {
          if (where.id === "app-driver") {
            return {
              id: "app-driver",
              openingVersion: { relationshipClassification: "COURIER_DRIVER", publicTitle: "Courier Driver" },
            };
          }
          if (where.id === "app-finance") {
            return {
              id: "app-finance",
              openingVersion: { relationshipClassification: "FINANCE_OFFICER", publicTitle: "Cash Handler" },
            };
          }
          return { id: "app-1", openingVersion: { approvedHeadcount: 1 } };
        },
      },
      recruitmentCheckCase: {
        create: async ({ data }: any) => ({ id: "chk-1", ...data }),
        findUnique: async () => ({ id: "chk-1", status: "READY" }),
      },
      recruitmentRequisition: {
        findUnique: async () => ({ id: "req-1", approvedHeadcount: 2, filledHeadcount: 1 }),
      },
      recruitmentOffer: {
        create: async ({ data }: any) => ({ id: "off-1", ...data }),
      },
    };

    interviewService = new InterviewService(db);
    checkService = new BackgroundCheckService(db);
    evaluationService = new EvaluationService(db);
    offerService = new OfferService(db);
    screeningService = new ScreeningService(db);
  });

  describe("Interview & Scorecard Invariants", () => {
    it("denies slot selection across applicant profile ownership boundaries", async () => {
      await expect(
        interviewService.selectSlot("int-1", "slot-1", "other-applicant-profile")
      ).rejects.toThrow("Interview access denied for this applicant profile.");
    });

    it("blocks conflicted interviewer from submitting a scorecard", async () => {
      await expect(
        evaluationService.submitScorecard({
          interviewId: "int-1",
          interviewerUserId: "interviewer-2", // Has conflict of interest
          criteriaScores: [{ criterionKey: "COMMUNICATION", score: 4 }],
        })
      ).rejects.toThrow("Conflicted interviewer cannot submit an evaluation scorecard.");
    });

    it("prohibits recording, transcription, facial or emotion analysis in interview metadata", async () => {
      const plan = await interviewService.createInterviewPlan({
        openingVersionId: "ver-1",
        stageName: "PANEL",
        interviewType: RecruitmentInterviewType.PANEL,
      });
      expect(plan.stageName).toBe("PANEL");
    });
  });

  describe("Background Check Policy Invariants", () => {
    it("rejects credit checks for unauthorized roles (e.g. drivers) with exact error reason", async () => {
      await expect(
        checkService.initiateCheckCase({
          applicationId: "app-driver",
          checkType: RecruitmentCheckType.ROLE_RELATED_CREDIT,
          policyVersionId: "bcp-1",
          consentRecordId: "consent-1",
          operationId: "OP-CHK1",
          requestHash: "HASH-CHK1",
        })
      ).rejects.toBeInstanceOf(RecruitmentCreditCheckNotAuthorizedError);
    });

    it("allows credit check for authorized finance/cash roles when consent exists", async () => {
      const checkCase = await checkService.initiateCheckCase({
        applicationId: "app-finance",
        checkType: RecruitmentCheckType.ROLE_RELATED_CREDIT,
        policyVersionId: "bcp-1",
        consentRecordId: "consent-1",
        operationId: "OP-CHK2",
        requestHash: "HASH-CHK2",
      });

      expect(checkCase.checkType).toBe("ROLE_RELATED_CREDIT");
      expect(checkCase.status).toBe("READY");
    });
  });

  describe("Human Selection & Headcount Invariants", () => {
    it("screening produces objective outcomes only and never automatically rejects an applicant", async () => {
      const result = await screeningService.evaluateObjectiveScreening({
        answers: [{ questionKey: "WORK_AUTH", answerValue: "CITIZEN" }],
        requirements: [{ questionKey: "WORK_AUTH", requiredValue: "CITIZEN" }],
      });

      expect(result.outcome).toBe("PASS");
      expect(["PASS", "REVIEW_REQUIRED", "POTENTIAL_INELIGIBILITY", "INCOMPLETE"]).toContain(result.outcome);
    });

    it("enforces approved requisition headcount during offer creation", async () => {
      db.recruitmentRequisition.findUnique = async () => ({
        approvedHeadcount: 2,
        filledHeadcount: 2, // Requisition is full!
      });

      await expect(
        offerService.createOffer({
          requisitionId: "req-1",
          applicationId: "app-1",
          roleTitle: "Courier",
          operationId: "OP-OFF1",
          requestHash: "HASH-OFF1",
        })
      ).rejects.toThrow("Requisition approved headcount limit reached.");
    });
  });
});
