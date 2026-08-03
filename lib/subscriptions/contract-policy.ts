import { SubscriptionError } from "@/lib/subscriptions/errors";

export type SubscriptionSubjectType = "CUSTOMER" | "STORE";
export type SubscriptionContractStatus = "DRAFT" | "PENDING_REVIEW" | "PENDING_PROVIDER_AUTHORIZATION" | "PENDING_INITIAL_PAYMENT" | "ACTIVE" | "PAST_DUE" | "GRACE" | "PAUSED" | "CANCELLATION_SCHEDULED" | "CANCELLED" | "EXPIRED" | "SUSPENDED" | "RECONCILIATION_REQUIRED";

const transitions: Readonly<Record<SubscriptionContractStatus, readonly SubscriptionContractStatus[]>> = Object.freeze({
  DRAFT: ["PENDING_REVIEW", "CANCELLED"],
  PENDING_REVIEW: ["PENDING_PROVIDER_AUTHORIZATION", "CANCELLED"],
  PENDING_PROVIDER_AUTHORIZATION: ["PENDING_INITIAL_PAYMENT", "RECONCILIATION_REQUIRED", "CANCELLED"],
  PENDING_INITIAL_PAYMENT: ["ACTIVE", "CANCELLED", "RECONCILIATION_REQUIRED"],
  ACTIVE: ["PAST_DUE", "PAUSED", "CANCELLATION_SCHEDULED", "SUSPENDED", "RECONCILIATION_REQUIRED", "EXPIRED"],
  PAST_DUE: ["GRACE", "ACTIVE", "SUSPENDED", "CANCELLATION_SCHEDULED", "RECONCILIATION_REQUIRED"],
  GRACE: ["ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLATION_SCHEDULED", "RECONCILIATION_REQUIRED"],
  PAUSED: ["ACTIVE", "CANCELLATION_SCHEDULED", "RECONCILIATION_REQUIRED"],
  CANCELLATION_SCHEDULED: ["CANCELLED", "ACTIVE", "RECONCILIATION_REQUIRED"],
  CANCELLED: [],
  EXPIRED: [],
  SUSPENDED: ["ACTIVE", "CANCELLATION_SCHEDULED", "CANCELLED", "RECONCILIATION_REQUIRED"],
  RECONCILIATION_REQUIRED: ["ACTIVE", "PAST_DUE", "GRACE", "PAUSED", "CANCELLATION_SCHEDULED", "CANCELLED", "SUSPENDED"],
});

export const terminalSubscriptionContractStatuses = new Set<SubscriptionContractStatus>(["CANCELLED", "EXPIRED"]);

export function assertSubscriptionSubject(input: Readonly<{ subjectType: SubscriptionSubjectType; customerUserId: string | null; storeId: string | null; payerUserId: string; storePayerAuthorised?: boolean }>): void {
  if (input.subjectType === "CUSTOMER") {
    if (!input.customerUserId || input.storeId || input.payerUserId !== input.customerUserId) throw new SubscriptionError("SUBSCRIPTION_ACCESS_DENIED", "Customer memberships require the authenticated customer to be payer and subject.");
    return;
  }
  if (!input.storeId || input.customerUserId || !input.storePayerAuthorised) throw new SubscriptionError("SUBSCRIPTION_ACCESS_DENIED", "Store memberships require one store and an authorised billing actor.");
}

export function assertContractTransition(from: SubscriptionContractStatus, to: SubscriptionContractStatus): void {
  if (!transitions[from].includes(to)) throw new SubscriptionError("SUBSCRIPTION_CONTRACT_TRANSITION_INVALID", `Contract cannot move from ${from} to ${to}.`);
}

export function rollingCancellationEffectiveAt(currentPeriodEnd: Date | null): Date {
  if (!currentPeriodEnd) throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "A rolling subscription must have a paid-period end before cancellation.");
  return currentPeriodEnd;
}
