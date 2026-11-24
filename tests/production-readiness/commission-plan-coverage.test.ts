import { describe, expect, it } from "vitest";
import { evaluateCommissionPlanCoverage } from "@/lib/production-readiness/commission-plan-coverage";

const now = new Date("2026-11-23T18:00:00.000Z");

function plan(overrides: Partial<Parameters<typeof evaluateCommissionPlanCoverage>[0]["plans"][number]> = {}) {
  return {
    subjectType: "COURIER_ORDER",
    scopeKey: "GLOBAL:COURIER_ORDER",
    currency: "ZAR",
    status: "ACTIVE",
    basisType: "ORDER_SUBTOTAL",
    effectiveFrom: new Date("2026-11-01T00:00:00.000Z"),
    effectiveUntil: null,
    calculationVersion: "commission-v1",
    createdByUserId: "maker",
    approvedByUserId: "reviewer",
    approvedAt: new Date("2026-11-02T00:00:00.000Z"),
    rules: [
      {
        id: "rule-1",
        ruleCode: "PLATFORM_FEE",
        allocationType: "PLATFORM_COMMISSION_REVENUE",
        beneficiaryType: "PLATFORM",
        calculationMethod: "PERCENTAGE_BPS",
        rateBasisPoints: 1000,
        fixedAmount: null,
        priority: 1,
      },
    ],
    ...overrides,
  };
}

describe("production commission-plan coverage", () => {
  it("requires an approved courier plan and an approved subtotal plan for every active store", () => {
    const result = evaluateCommissionPlanCoverage({
      now,
      activeStoreIds: ["store-a", "store-b"],
      plans: [
        plan(),
        plan({ subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: "STORE:store-a" }),
        plan({ subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: "STORE:store-b" }),
      ],
    });
    expect(result).toMatchObject({ ready: true, reasonCode: "APPROVED_COMMISSION_SCOPE_COVERAGE_CURRENT", evidence: { activeStoreCount: 2, activeStorePlanCount: 2, missingStorePlanCount: 0 } });
  });

  it("does not let one unrelated active plan make all store settlement scopes ready", () => {
    const result = evaluateCommissionPlanCoverage({ now, activeStoreIds: ["store-a"], plans: [plan()] });
    expect(result).toMatchObject({ ready: false, reasonCode: "STORE_COMMISSION_PLAN_COVERAGE_INCOMPLETE", evidence: { missingStorePlanCount: 1 } });
  });

  it("rejects draft, expired, self-approved, ruleless, and malformed or mismatched commission plans", () => {
    const baseRule = plan().rules[0] as Record<string, unknown>;
    const rejected = [
      plan({ status: "DRAFT" }),
      plan({ effectiveUntil: new Date("2026-11-20T00:00:00.000Z") }),
      plan({ approvedByUserId: "maker" }),
      plan({ rules: [] }),
      plan({ rules: [null] }),
      plan({ rules: [{ id: "rule-1" }] }),
      plan({ rules: [{ ...baseRule, calculationMethod: "FIXED_AMOUNT", fixedAmount: null, rateBasisPoints: null }] }),
      plan({ rules: [{ ...baseRule, allocationType: "BENEFICIARY_COMMISSION_PAYABLE", beneficiaryType: "PLATFORM" }] }),
      plan({ rules: [{ ...baseRule, ruleCode: "DUP" }, { ...baseRule, ruleCode: "DUP", priority: 2 }] }),
    ];
    const result = evaluateCommissionPlanCoverage({ now, activeStoreIds: [], plans: rejected });
    expect(result).toMatchObject({ ready: false, reasonCode: "COURIER_COMMISSION_PLAN_MISSING" });

    const fixedValid = evaluateCommissionPlanCoverage({
      now,
      activeStoreIds: ["store-a"],
      plans: [
        plan(),
        plan({
          subjectType: "MARKETPLACE_STORE_ORDER",
          scopeKey: "STORE:store-a",
          rules: [
            {
              ruleCode: "STORE_FIXED",
              allocationType: "PLATFORM_COMMISSION_REVENUE",
              beneficiaryType: "PLATFORM",
              calculationMethod: "FIXED_AMOUNT",
              rateBasisPoints: null,
              fixedAmount: "5.00",
              priority: 1,
            },
          ],
        }),
      ],
    });
    expect(fixedValid.ready).toBe(true);
  });

  it("rejects duplicate active plans for one launch scope instead of reporting a false green", () => {
    const result = evaluateCommissionPlanCoverage({
      now,
      activeStoreIds: [],
      plans: [plan(), plan({ calculationVersion: "commission-v2" })],
    });
    expect(result).toMatchObject({ ready: false, reasonCode: "COURIER_COMMISSION_SCOPE_AMBIGUOUS" });
  });

  it("requires courier commission even when no marketplace stores are active", () => {
    const result = evaluateCommissionPlanCoverage({ now, activeStoreIds: [], plans: [] });
    expect(result).toMatchObject({ ready: false, reasonCode: "COURIER_COMMISSION_PLAN_MISSING", evidence: { activeStoreCount: 0 } });
  });
});
