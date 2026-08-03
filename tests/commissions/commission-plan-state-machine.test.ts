import { describe, expect, it } from "vitest";
import { assertCommissionPlanTransition, canTransitionCommissionPlan } from "@/lib/commissions/commission-plan-state-machine";

describe("commission plan state machine", () => {
  it("allows only the reviewed policy lifecycle", () => {
    expect(canTransitionCommissionPlan("DRAFT", "UNDER_REVIEW")).toBe(true);
    expect(canTransitionCommissionPlan("UNDER_REVIEW", "APPROVED")).toBe(true);
    expect(canTransitionCommissionPlan("APPROVED", "ACTIVE")).toBe(true);
    expect(canTransitionCommissionPlan("ACTIVE", "RETIRED")).toBe(true);
  });
  it("rejects mutable or terminal transitions", () => {
    expect(() => assertCommissionPlanTransition("ACTIVE", "DRAFT")).toThrow(/cannot transition/i);
    expect(() => assertCommissionPlanTransition("RETIRED", "ACTIVE")).toThrow(/cannot transition/i);
  });
});
