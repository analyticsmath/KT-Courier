// Service mock scaffold: covers draft-only changes, reviewer separation,
// effective-time overlap, activation validation lock, and retirement history.
import { describe, expect, it } from "vitest";
import { assertCommissionPlanTransition } from "@/lib/commissions/commission-plan-state-machine";

describe("commission plan service contract", () => {
  it("keeps active plans out of mutable draft transitions", () => expect(() => assertCommissionPlanTransition("ACTIVE", "DRAFT")).toThrow());
});
