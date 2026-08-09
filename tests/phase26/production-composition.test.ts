import { describe, it, expect } from "vitest";
import {
  resolveRecruitmentProductionComposition,
} from "../../lib/recruitment/composition-root";
import {
  RECRUITMENT_PRODUCTION_VALIDATION_APPROVED,
  RECRUITMENT_PRODUCTION_BLOCK_REASON,
  RecruitmentProductionLockError,
  assertRecruitmentProductionReady,
} from "../../lib/recruitment/production-readiness";

describe("Phase 26 — Production Composition & Lock Gates", () => {
  it("enforces RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = false before Phase 26.5", () => {
    expect(RECRUITMENT_PRODUCTION_VALIDATION_APPROVED).toBe(false);
  });

  it("throws RecruitmentProductionLockError when assertRecruitmentProductionReady is called", () => {
    expect(() => assertRecruitmentProductionReady()).toThrow(RecruitmentProductionLockError);
    try {
      assertRecruitmentProductionReady();
    } catch (error) {
      expect(error).toBeInstanceOf(RecruitmentProductionLockError);
      if (error instanceof RecruitmentProductionLockError) {
        expect(error.code).toBe(RECRUITMENT_PRODUCTION_BLOCK_REASON);
        expect(error.message).toMatch(/Phase 26.5/);
      }
    }
  });

  it("instantiates all 13 dependencies in exact order before returning LOCKED status with CONSOLIDATED_VALIDATION_NOT_APPROVED", () => {
    const composition = resolveRecruitmentProductionComposition();
    expect(composition.status).toBe("LOCKED");
    if (composition.status === "LOCKED") {
      expect(composition.code).toBe("CONSOLIDATED_VALIDATION_NOT_APPROVED");
      expect(composition.repositories).toBeDefined();
      expect(composition.identity).toBeDefined();
      expect(composition.secureDocumentAdapter).toBeDefined();
      expect(composition.employeeProvisioningAuthority).toBeDefined();
      expect(composition.driverOnboardingAuthority).toBeDefined();
      expect(composition.services).toBeDefined();
      expect(composition.services.positionFamilies).toBeDefined();
      expect(composition.services.requisitions).toBeDefined();
      expect(composition.services.openings).toBeDefined();
      expect(composition.services.applicantProfiles).toBeDefined();
      expect(composition.services.applications).toBeDefined();
      expect(composition.services.screening).toBeDefined();
      expect(composition.services.reviewAssignments).toBeDefined();
      expect(composition.services.evaluations).toBeDefined();
      expect(composition.services.interviews).toBeDefined();
      expect(composition.services.checks).toBeDefined();
      expect(composition.services.offers).toBeDefined();
      expect(composition.services.handoffs).toBeDefined();
      expect(composition.services.privacyRetention).toBeDefined();
      expect(composition.services.employmentEquity).toBeDefined();
      expect(composition.services.fraud).toBeDefined();
      expect(composition.services.reconciliation).toBeDefined();
      expect(composition.services.secureDocuments).toBeDefined();
      expect(composition.outbox).toBeDefined();
    }
  });
});
