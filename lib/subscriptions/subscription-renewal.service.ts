import { SubscriptionError } from "@/lib/subscriptions/errors";
import { assertSubscriptionsProductionReady } from "@/lib/subscriptions/production-lock";
import type { RecurringPaymentProvider } from "@/lib/subscriptions/providers/recurring-payment-provider";

export type SubscriptionRenewalRepository = Readonly<{
  lockRenewalJob(operationId: string): Promise<Readonly<{ status: "PENDING" | "RETRYABLE" | "PAYMENT_PENDING" | "COMPLETED" | "CANCELLED" | "RECONCILIATION_REQUIRED"; authorityReference: string; invoiceReference: string; paymentReference: string; amount: string; currency: "ZAR" }> | null>;
  markPaymentPending(operationId: string, safeEvidence: Record<string, string>): Promise<void>;
  markUnknownOutcomeForReconciliation(operationId: string, safeEvidence: Record<string, string>): Promise<void>;
  markDefinitiveFailure(operationId: string, safeEvidence: Record<string, string>): Promise<void>;
}>;

/** Provider work begins only after the repository locks and commits durable invoice/payment evidence. */
export async function processSubscriptionRenewal(repository: SubscriptionRenewalRepository, provider: RecurringPaymentProvider, input: Readonly<{ operationId: string; testApproval?: { approved: true } }>) {
  assertSubscriptionsProductionReady("RECURRING_CHARGE", input.testApproval);
  const job = await repository.lockRenewalJob(input.operationId);
  if (!job) throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "Renewal work was not found.");
  if (job.status === "COMPLETED" || job.status === "CANCELLED") return Object.freeze({ outcome: "REPLAY" as const });
  if (job.status === "RECONCILIATION_REQUIRED") return Object.freeze({ outcome: "RECONCILIATION_REQUIRED" as const });
  const result = await provider.chargeBillingCycle({ authorityReference: job.authorityReference, invoiceReference: job.invoiceReference, paymentReference: job.paymentReference, amount: job.amount, currency: job.currency, operationId: input.operationId });
  if (result.status === "PENDING") { await repository.markPaymentPending(input.operationId, result.safeEvidence); return Object.freeze({ outcome: "PAYMENT_PENDING" as const }); }
  if (result.status === "FAILED") { await repository.markDefinitiveFailure(input.operationId, result.safeEvidence); return Object.freeze({ outcome: "FAILED" as const }); }
  await repository.markUnknownOutcomeForReconciliation(input.operationId, result.safeEvidence);
  return Object.freeze({ outcome: "RECONCILIATION_REQUIRED" as const });
}
