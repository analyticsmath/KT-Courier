import { resolvePayfastConfiguration } from "@/lib/payments/providers/payfast/payfast-config";
import { PayfastRecurringPaymentAdapter } from "@/lib/subscriptions/providers/payfast-recurring-adapter";
import { createPrismaSubscriptionContractRepository, createPrismaSubscriptionReviewRepository } from "@/lib/subscriptions/prisma-subscription.repository";
import { assertSubscriptionsProductionReady, type SubscriptionLockedOperation } from "@/lib/subscriptions/production-lock";
import { SubscriptionError } from "@/lib/subscriptions/errors";

/** Resolves concrete authorities before the separate Phase 22 source gate. */
export function resolveSubscriptionProductionComposition() {
  const payfast = resolvePayfastConfiguration();
  if (!payfast.runtime || !payfast.state.active) throw new SubscriptionError("CONSOLIDATED_VALIDATION_NOT_APPROVED", "PayFast subscription composition is not configured for validated operation.");
  return Object.freeze({
    reviews: createPrismaSubscriptionReviewRepository(),
    contracts: createPrismaSubscriptionContractRepository(),
    recurringProvider: new PayfastRecurringPaymentAdapter(payfast.runtime),
    phase10Authority: "payment-preparation.service / Payment" as const,
    phase12Authority: "payfast-itn-application.service" as const,
    phase15Authority: "refund-request.service" as const,
    lifecycleRepositories: "prisma-subscription-lifecycle.repository" as const,
  });
}

export function resolveAndAssertSubscriptionOperation(operation: SubscriptionLockedOperation) {
  const composition = resolveSubscriptionProductionComposition();
  assertSubscriptionsProductionReady(operation);
  return composition;
}
