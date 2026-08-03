import { randomBytes } from "node:crypto";
import { assertOfferablePlan, assertPlanTransition, type SubscriptionPlanStatus } from "@/lib/subscriptions/plan-policy";
import { assertSubscriptionsProductionReady } from "@/lib/subscriptions/production-lock";
import { SubscriptionError } from "@/lib/subscriptions/errors";

export type SubscriptionPlanLifecycleRepository = Readonly<{
  getPlan(reference: string): Promise<Readonly<{ id: string; status: SubscriptionPlanStatus; currency: string; priceAmount: string; contractTermType: "ROLLING_MONTH_TO_MONTH" | "FIXED_TERM"; effectiveFrom: Date | null; effectiveUntil: Date | null }> | null>;
  transitionPlan(input: Readonly<{ id: string; from: SubscriptionPlanStatus; to: SubscriptionPlanStatus; actorUserId: string; operationId: string; rejectionReason?: string }>): Promise<void>;
}>;

export async function transitionSubscriptionPlanVersion(repository: SubscriptionPlanLifecycleRepository, input: Readonly<{ reference: string; to: SubscriptionPlanStatus; actorUserId: string; operationId: string; rejectionReason?: string; testApproval?: { approved: true } }>) {
  const plan = await repository.getPlan(input.reference);
  if (!plan) throw new SubscriptionError("SUBSCRIPTION_PLAN_NOT_OFFERABLE", "Plan version was not found.");
  assertPlanTransition(plan.status, input.to);
  if (input.to === "ACTIVE") {
    assertOfferablePlan({ ...plan, status: "ACTIVE", at: new Date() });
    assertSubscriptionsProductionReady("PLAN_ACTIVATION", input.testApproval);
  }
  if (input.to === "REJECTED" && !input.rejectionReason?.trim()) throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "Rejected plan versions require a safe reason.");
  await repository.transitionPlan({ id: plan.id, from: plan.status, to: input.to, actorUserId: input.actorUserId, operationId: input.operationId, rejectionReason: input.rejectionReason });
  return Object.freeze({ reference: input.reference, status: input.to });
}

export const newSubscriptionReference = (prefix: string) => `${prefix}_${randomBytes(12).toString("base64url")}`;
