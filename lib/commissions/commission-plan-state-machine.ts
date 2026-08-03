import { CommissionError } from "./errors";

export type CommissionPlanStatusCode = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "RETIRED" | "REJECTED";

const TRANSITIONS: Readonly<Record<CommissionPlanStatusCode, readonly CommissionPlanStatusCode[]>> = Object.freeze({
  DRAFT: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["ACTIVE", "REJECTED"],
  ACTIVE: ["RETIRED"],
  RETIRED: [],
  REJECTED: [],
});

export function canTransitionCommissionPlan(from: CommissionPlanStatusCode, to: CommissionPlanStatusCode): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertCommissionPlanTransition(from: CommissionPlanStatusCode, to: CommissionPlanStatusCode): void {
  if (!canTransitionCommissionPlan(from, to)) {
    throw new CommissionError("COMMISSION_INVALID_STATE", `Commission plan cannot transition from ${from} to ${to}.`);
  }
}

export const commissionPlanTransitions = TRANSITIONS;
