import { describe, expect, it } from "vitest";
import {
  DISPATCH_SYSTEM_ACTOR,
  decideDispatchAutomation,
  describeManualDispatchReason,
  dispatchPolicyAllowsRegion,
  evaluateDispatchAutomationPolicy,
  parseAutoDispatchSetting,
} from "@/lib/dispatch/automation-policy";

describe("dispatch automation policy evaluator (fail-closed)", () => {
  const basePolicy = {
    id: "pol-1",
    publicReference: "dspauto_test123",
    versionNumber: 1,
    status: "ACTIVE",
    regionIds: ["reg-jhb", "reg-cpt"],
    maxOfferAttempts: 3,
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveUntil: new Date("2026-12-31T23:59:59Z"),
    createdByUserId: "user-author",
    approvedByUserId: "user-approver",
    approvedAt: new Date("2026-01-01T08:00:00Z"),
    activatedByUserId: "user-activator",
    activatedAt: new Date("2026-01-01T09:00:00Z"),
  };

  const testNow = new Date("2026-06-01T12:00:00Z");

  describe("parseAutoDispatchSetting", () => {
    it("fails closed for null, undefined, false, or malformed values", () => {
      expect(parseAutoDispatchSetting(null)).toBe(false);
      expect(parseAutoDispatchSetting(undefined)).toBe(false);
      expect(parseAutoDispatchSetting(false)).toBe(false);
      expect(parseAutoDispatchSetting("false")).toBe(false);
      expect(parseAutoDispatchSetting("off")).toBe(false);
      expect(parseAutoDispatchSetting(0)).toBe(false);
      expect(parseAutoDispatchSetting({})).toBe(false);
      expect(parseAutoDispatchSetting([])).toBe(false);
    });

    it("enables only on exact boolean true or 'true'", () => {
      expect(parseAutoDispatchSetting(true)).toBe(true);
      expect(parseAutoDispatchSetting("true")).toBe(true);
      expect(parseAutoDispatchSetting("  true  ")).toBe(true);
    });
  });

  describe("evaluateDispatchAutomationPolicy", () => {
    it("blocks when no policy row exists", () => {
      expect(evaluateDispatchAutomationPolicy(null, testNow)).toEqual({
        allowed: false,
        reason: "NO_APPROVED_POLICY",
      });
    });

    it("blocks when policy status is not ACTIVE", () => {
      expect(evaluateDispatchAutomationPolicy({ ...basePolicy, status: "DRAFT" }, testNow)).toEqual({
        allowed: false,
        reason: "POLICY_NOT_ACTIVE",
      });
      expect(evaluateDispatchAutomationPolicy({ ...basePolicy, status: "APPROVED" }, testNow)).toEqual({
        allowed: false,
        reason: "POLICY_NOT_ACTIVE",
      });
    });

    it("blocks when maker/checker is violated (self-approval)", () => {
      expect(
        evaluateDispatchAutomationPolicy(
          { ...basePolicy, approvedByUserId: "user-author" },
          testNow
        )
      ).toEqual({
        allowed: false,
        reason: "POLICY_EVIDENCE_INCOMPLETE",
      });
    });

    it("blocks when approval or activation evidence is missing", () => {
      expect(
        evaluateDispatchAutomationPolicy({ ...basePolicy, approvedAt: null }, testNow)
      ).toEqual({
        allowed: false,
        reason: "POLICY_EVIDENCE_INCOMPLETE",
      });
      expect(
        evaluateDispatchAutomationPolicy({ ...basePolicy, activatedByUserId: null }, testNow)
      ).toEqual({
        allowed: false,
        reason: "POLICY_EVIDENCE_INCOMPLETE",
      });
    });

    it("blocks when effective interval is in the future or expired", () => {
      const futureFrom = new Date("2026-10-01T00:00:00Z");
      expect(
        evaluateDispatchAutomationPolicy({ ...basePolicy, effectiveFrom: futureFrom }, testNow)
      ).toEqual({
        allowed: false,
        reason: "POLICY_NOT_EFFECTIVE",
      });

      const pastUntil = new Date("2026-05-01T00:00:00Z");
      expect(
        evaluateDispatchAutomationPolicy({ ...basePolicy, effectiveUntil: pastUntil }, testNow)
      ).toEqual({
        allowed: false,
        reason: "POLICY_NOT_EFFECTIVE",
      });
    });

    it("blocks when policy scope is invalid (empty regions or out-of-range attempts)", () => {
      expect(
        evaluateDispatchAutomationPolicy({ ...basePolicy, regionIds: [] }, testNow)
      ).toEqual({
        allowed: false,
        reason: "POLICY_SCOPE_INVALID",
      });
      expect(
        evaluateDispatchAutomationPolicy({ ...basePolicy, maxOfferAttempts: 0 }, testNow)
      ).toEqual({
        allowed: false,
        reason: "POLICY_SCOPE_INVALID",
      });
      expect(
        evaluateDispatchAutomationPolicy({ ...basePolicy, maxOfferAttempts: 15 }, testNow)
      ).toEqual({
        allowed: false,
        reason: "POLICY_SCOPE_INVALID",
      });
    });

    it("allows valid active policy with frozen decision", () => {
      const decision = evaluateDispatchAutomationPolicy(basePolicy, testNow);
      expect(decision.allowed).toBe(true);
      if (decision.allowed) {
        expect(decision.policyReference).toBe("dspauto_test123");
        expect(decision.policyVersion).toBe(1);
        expect(decision.approvedByUserId).toBe("user-approver");
        expect(decision.maxOfferAttempts).toBe(3);
        expect(decision.regionIds).toEqual(["reg-jhb", "reg-cpt"]);
        expect(Object.isFrozen(decision)).toBe(true);
      }
    });
  });

  describe("decideDispatchAutomation", () => {
    it("blocks with AUTO_DISPATCH_SETTING_OFF when setting is disabled even with valid policy", () => {
      const decision = decideDispatchAutomation({
        settingValue: false,
        policyRow: basePolicy,
        now: testNow,
      });
      expect(decision).toEqual({ allowed: false, reason: "AUTO_DISPATCH_SETTING_OFF" });
    });

    it("allows when both setting is true and policy is valid", () => {
      const decision = decideDispatchAutomation({
        settingValue: true,
        policyRow: basePolicy,
        now: testNow,
      });
      expect(decision.allowed).toBe(true);
    });
  });

  describe("dispatchPolicyAllowsRegion", () => {
    const allowedDecision = decideDispatchAutomation({
      settingValue: true,
      policyRow: basePolicy,
      now: testNow,
    });

    it("checks region membership against policy scope", () => {
      expect(dispatchPolicyAllowsRegion(allowedDecision, "reg-jhb")).toBe(true);
      expect(dispatchPolicyAllowsRegion(allowedDecision, "reg-cpt")).toBe(true);
      expect(dispatchPolicyAllowsRegion(allowedDecision, "reg-dbn")).toBe(false);
      expect(dispatchPolicyAllowsRegion(allowedDecision, null)).toBe(false);
    });

    it("returns false for blocked decision regardless of region", () => {
      const blockedDecision = decideDispatchAutomation({
        settingValue: false,
        policyRow: basePolicy,
        now: testNow,
      });
      expect(dispatchPolicyAllowsRegion(blockedDecision, "reg-jhb")).toBe(false);
    });
  });

  describe("describeManualDispatchReason", () => {
    it("returns safe label and actionable next step for known reason codes", () => {
      const res = describeManualDispatchReason("ORDER_REGION_OUTSIDE_POLICY_SCOPE");
      expect(res.code).toBe("ORDER_REGION_OUTSIDE_POLICY_SCOPE");
      expect(res.label).toContain("not covered by the approved automation policy");
      expect(res.nextStep).toContain("Select a compliant driver manually");
    });

    it("falls back gracefully for unknown reason codes", () => {
      const res = describeManualDispatchReason("SOMETHING_UNEXPECTED");
      expect(res.code).toBe("UNKNOWN");
      expect(res.label).toBe("Automatic routing stopped for an unrecorded reason.");
      expect(res.nextStep).toContain("Select a compliant driver manually");
    });
  });

  it("exports typed system actor constant", () => {
    expect(DISPATCH_SYSTEM_ACTOR).toBe("SYSTEM:marketplace-dispatch");
  });
});
