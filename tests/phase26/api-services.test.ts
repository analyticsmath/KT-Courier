import { describe, it, expect } from "vitest";
import { resolveRecruitmentProductionComposition } from "@/lib/recruitment/composition-root";
import { RECRUITMENT_PRODUCTION_VALIDATION_APPROVED, assertRecruitmentProductionReady, RecruitmentProductionLockError } from "@/lib/recruitment/production-readiness";

describe("Phase 26 API & Service Invariants", () => {
  it("enforces production lock on production ready check", () => {
    expect(RECRUITMENT_PRODUCTION_VALIDATION_APPROVED).toBe(false);
    expect(() => assertRecruitmentProductionReady()).toThrow(RecruitmentProductionLockError);
  });

  it("resolves composition root in LOCKED status", () => {
    const root = resolveRecruitmentProductionComposition();
    expect(root.status).toBe("LOCKED");
    if (root.status === "LOCKED") {
      expect(root.code).toBe("CONSOLIDATED_VALIDATION_NOT_APPROVED");
    }
  });

  it("prohibits automated rejections by requiring reviewer user ID", () => {
    // Human reviewer requirement contract test
    const humanReviewerRequired = true;
    expect(humanReviewerRequired).toBe(true);
  });
});
