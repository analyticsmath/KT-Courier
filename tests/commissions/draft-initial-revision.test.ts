import { expect, test } from "vitest";
import { CommissionPlanUpdateSchema } from "@/lib/validation/commissions";

test("draft editing accepts the persisted initial revision zero and rejects invalid revisions", () => {
  const draft = { subjectType: "COURIER_ORDER", scopeKey: "GLOBAL:COURIER_ORDER", basisType: "ORDER_SUBTOTAL", effectiveFrom: "2026-01-01T00:00:00.000Z", calculationVersion: "disposable-test", operationId: "disposable-operation", rules: [{ ruleCode: "PLATFORM", allocationType: "PLATFORM_COMMISSION_REVENUE", beneficiaryType: "PLATFORM", calculationMethod: "FIXED_AMOUNT", fixedAmount: "1.00", priority: 1 }] };
  expect(CommissionPlanUpdateSchema.safeParse({ ...draft, expectedVersion: 0 }).success).toBe(true);
  expect(CommissionPlanUpdateSchema.safeParse({ ...draft, expectedVersion: -1 }).success).toBe(false);
  expect(CommissionPlanUpdateSchema.safeParse({ ...draft, expectedVersion: 0.5 }).success).toBe(false);
});
