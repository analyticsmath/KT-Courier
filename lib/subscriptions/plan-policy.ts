import { SubscriptionError } from "@/lib/subscriptions/errors";

export type SubscriptionPlanStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "REJECTED" | "RETIRED";

const transitions: Readonly<Record<SubscriptionPlanStatus, readonly SubscriptionPlanStatus[]>> = Object.freeze({
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["ACTIVE"],
  ACTIVE: ["RETIRED"],
  REJECTED: [],
  RETIRED: [],
});

export function assertPlanTransition(from: SubscriptionPlanStatus, to: SubscriptionPlanStatus): void {
  if (!transitions[from].includes(to)) throw new SubscriptionError("SUBSCRIPTION_PLAN_TRANSITION_INVALID", `Plan cannot move from ${from} to ${to}.`);
}

export function assertOfferablePlan(input: Readonly<{
  status: SubscriptionPlanStatus;
  currency: string;
  priceAmount: string;
  contractTermType: "ROLLING_MONTH_TO_MONTH" | "FIXED_TERM";
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  at: Date;
}>): void {
  if (input.status !== "ACTIVE" || input.currency !== "ZAR" || Number(input.priceAmount) <= 0) throw new SubscriptionError("SUBSCRIPTION_PLAN_NOT_OFFERABLE", "This membership plan is not currently offerable.");
  if (input.contractTermType !== "ROLLING_MONTH_TO_MONTH") throw new SubscriptionError("SUBSCRIPTION_PLAN_NOT_OFFERABLE", "Fixed-term memberships are source-locked pending separate approval.");
  if ((input.effectiveFrom && input.effectiveFrom > input.at) || (input.effectiveUntil && input.effectiveUntil <= input.at)) throw new SubscriptionError("SUBSCRIPTION_PLAN_NOT_OFFERABLE", "This membership plan is not currently effective.");
}

export const immutablePlanStatuses = new Set<SubscriptionPlanStatus>(["ACTIVE", "RETIRED"]);
