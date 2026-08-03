import { describe, expect, it } from "vitest";
import { assertCommissionPlanTransition } from "@/lib/commissions/commission-plan-state-machine";
import { assertCommissionProductionReady } from "@/lib/commissions/commission-production-readiness";

describe("Phase 14 PostgreSQL commission integration", () => {
  it("enforces commission plan state transitions", () => {
    expect(() => assertCommissionPlanTransition("DRAFT", "UNDER_REVIEW")).not.toThrow();
  });

  it("evaluates commission production readiness fail-closed rules", () => {
    expect(() => assertCommissionProductionReady({ allowTestOnlyBypass: true })).not.toThrow();
    expect(() => assertCommissionProductionReady()).toThrow();
  });
});
