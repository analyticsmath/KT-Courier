import { SubscriptionError } from "@/lib/subscriptions/errors";

export const SUBSCRIPTIONS_PRODUCTION_VALIDATION_APPROVED = false as const;
export const SUBSCRIPTIONS_PRODUCTION_BLOCK_REASON = "CONSOLIDATED_VALIDATION_NOT_APPROVED" as const;

export type SubscriptionLockedOperation =
  | "PLAN_ACTIVATION"
  | "PROVIDER_AUTHORIZATION"
  | "INITIAL_PAYMENT"
  | "RECURRING_CHARGE"
  | "ENTITLEMENT_CONSUMPTION"
  | "CANCELLATION_PROVIDER_MUTATION"
  | "PROVIDER_SYNCHRONIZATION"
  | "ADMIN_RECOVERY"
  | "PAUSE_RESUME";

/** There is deliberately no environment-variable bypass. */
export function assertSubscriptionsProductionReady(
  operation: SubscriptionLockedOperation,
  testApproval?: { approved: true },
): void {
  if (SUBSCRIPTIONS_PRODUCTION_VALIDATION_APPROVED || testApproval?.approved === true) return;
  throw new SubscriptionError(
    SUBSCRIPTIONS_PRODUCTION_BLOCK_REASON,
    `${SUBSCRIPTIONS_PRODUCTION_BLOCK_REASON}: ${operation} is unavailable until consolidated validation is approved.`,
  );
}

export function subscriptionsProductionReady(): boolean {
  return SUBSCRIPTIONS_PRODUCTION_VALIDATION_APPROVED;
}
