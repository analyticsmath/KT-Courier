/* eslint-disable @typescript-eslint/no-explicit-any -- focused fake repositories exercise DB-free service boundaries. */
import { beforeEach, describe, expect, it } from "vitest";
import { ApplicantProfileService } from "@/lib/recruitment/applicant-profile.service";
import { ApplicationService } from "@/lib/recruitment/application.service";
import { InterviewService } from "@/lib/recruitment/interview.service";
import { RecruitmentIneligibilityError, RecruitmentError } from "@/lib/recruitment/errors";

describe("Phase 26 DB-free service invariants", () => {
  let db: any;
  beforeEach(() => {
    db = {
      recruitmentApplicantProfile: { findUnique: async () => null, create: async ({ data }: any) => data },
      recruitmentApplication: { findUnique: async () => ({ id: "app-1", status: "DRAFT" }) },
      recruitmentSubmittedAnswer: { upsert: async ({ create }: any) => create },
    };
  });

  it("fails closed for under-18 applicant profiles", async () => {
    const service = new ApplicantProfileService(db);
    await expect(service.createOrGetApplicantProfile({ userId: "u1", legalName: "Applicant", primaryEmailReference: "a@example.test", workAuthorizationStatus: "CITIZEN" as any, isAdult: false })).rejects.toBeInstanceOf(RecruitmentIneligibilityError);
  });

  it("allows draft answers but preserves the draft-only write boundary", async () => {
    const service = new ApplicationService(db);
    await expect(service.saveSubmittedAnswers("app-1", [{ questionKey: "eligibility", answerValue: true }])).resolves.toEqual([{ applicationId: "app-1", questionKey: "eligibility", answerValue: true }]);
    db.recruitmentApplication.findUnique = async () => ({ id: "app-1", status: "SUBMITTED" });
    await expect(service.saveSubmittedAnswers("app-1", [{ questionKey: "eligibility", answerValue: false }])).rejects.toBeInstanceOf(RecruitmentError);
  });

  it("requires an approved applicant-facing category for human rejection", async () => {
    const service = new ApplicationService(db);
    await expect(service.rejectApplication("APP-1", "ANY", "UNSAFE_INTERNAL_DETAIL", "reviewer-1")).rejects.toBeInstanceOf(RecruitmentError);
  });

  it("denies interview slot selection across applicant profiles", async () => {
    const service = new InterviewService({
      recruitmentInterview: { findUnique: async () => ({ application: { applicantProfileId: "owner-1" } }) },
    });
    await expect(service.selectSlot("INT-1", "SLT-1", "other-applicant")).rejects.toBeInstanceOf(RecruitmentError);
  });
});
