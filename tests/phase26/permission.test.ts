import { describe, it, expect } from "vitest";
import { PERMISSIONS, SYSTEM_PERMISSION_DEFINITIONS } from "../../lib/auth/permission-keys";

const FORBIDDEN_PERMISSION_KEYS = [
  "recruitment_automated_reject",
  "recruitment_automated_hire",
  "recruitment_manual_employee_activate",
  "recruitment_manual_driver_activate",
  "recruitment_bypass_checks",
  "recruitment_view_all_special_information",
  "recruitment_view_unrelated_user_activity",
  "recruitment_manual_offer_accept",
  "recruitment_manual_handoff_complete",
] as const;

describe("Phase 26 — Recruitment Permission Keys & Definitions", () => {
  it("defines all mandatory Phase 26 recruitment permissions", () => {
    expect(PERMISSIONS.RECRUITMENT_OPENINGS_READ_PUBLIC).toBe("recruitment_openings.read_public");
    expect(PERMISSIONS.APPLICANT_PROFILE_READ_OWN).toBe("applicant_profile.read_own");
    expect(PERMISSIONS.APPLICANT_PROFILE_MANAGE_OWN).toBe("applicant_profile.manage_own");
    expect(PERMISSIONS.APPLICANT_APPLICATIONS_CREATE_OWN).toBe("applicant_applications.create_own");
    expect(PERMISSIONS.APPLICANT_APPLICATIONS_READ_OWN).toBe("applicant_applications.read_own");
    expect(PERMISSIONS.APPLICANT_APPLICATIONS_SUBMIT_OWN).toBe("applicant_applications.submit_own");
    expect(PERMISSIONS.APPLICANT_APPLICATIONS_WITHDRAW_OWN).toBe("applicant_applications.withdraw_own");
    expect(PERMISSIONS.RECRUITMENT_READ).toBe("recruitment.read");
    expect(PERMISSIONS.RECRUITMENT_REQUISITIONS_MANAGE).toBe("recruitment_requisitions.manage");
    expect(PERMISSIONS.RECRUITMENT_REQUISITIONS_APPROVE).toBe("recruitment_requisitions.approve");
    expect(PERMISSIONS.RECRUITMENT_OPENINGS_MANAGE).toBe("recruitment_openings.manage");
    expect(PERMISSIONS.RECRUITMENT_OPENINGS_PUBLISH).toBe("recruitment_openings.publish");
    expect(PERMISSIONS.RECRUITMENT_APPLICATIONS_READ).toBe("recruitment_applications.read");
    expect(PERMISSIONS.RECRUITMENT_DECISIONS_CREATE).toBe("recruitment_decisions.create");
    expect(PERMISSIONS.RECRUITMENT_SCORECARDS_SUBMIT).toBe("recruitment_scorecards.submit");
    expect(PERMISSIONS.RECRUITMENT_CHECKS_READ).toBe("recruitment_checks.read");
    expect(PERMISSIONS.RECRUITMENT_OFFERS_MANAGE).toBe("recruitment_offers.manage");
    expect(PERMISSIONS.RECRUITMENT_OFFERS_APPROVE).toBe("recruitment_offers.approve");
    expect(PERMISSIONS.RECRUITMENT_HANDOFFS_READ).toBe("recruitment_handoffs.read");
    expect(PERMISSIONS.RECRUITMENT_HANDOFFS_PROCESS).toBe("recruitment_handoffs.process");
    expect(PERMISSIONS.RECRUITMENT_FRAUD_READ).toBe("recruitment_fraud.read");
    expect(PERMISSIONS.RECRUITMENT_RECONCILIATION_READ).toBe("recruitment_reconciliation.read");
  });

  it("verifies NO prohibited automated/bypass permissions exist in PERMISSIONS or definitions", () => {
    const keys = Object.values(PERMISSIONS);
    const defKeys = SYSTEM_PERMISSION_DEFINITIONS.map((d: any) => d.key);

    for (const forbiddenKey of FORBIDDEN_PERMISSION_KEYS) {
      expect(keys).not.toContain(forbiddenKey);
      expect(defKeys).not.toContain(forbiddenKey);
    }
  });

  it("ensures applicant permissions are restricted to applicant self-service only", () => {
    const applicantKeys = Object.entries(PERMISSIONS)
      .filter(([k]) => k.startsWith("APPLICANT_"))
      .map(([, v]) => v);

    for (const key of applicantKeys) {
      expect(key).toMatch(/_own$/);
    }
  });
});
