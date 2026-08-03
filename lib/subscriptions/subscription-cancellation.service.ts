import { SubscriptionError } from "@/lib/subscriptions/errors";
import { assertSubscriptionsProductionReady } from "@/lib/subscriptions/production-lock";
import type { PayfastRecurringProtocol, RecurringProviderAuthority, SubscriptionProviderStatus } from "@/lib/subscriptions/providers/recurring-payment-provider";

export type SubscriptionCancellationRepository = Readonly<{
  requestRollingCancellation(input: Readonly<{ contractReference: string; payerUserId: string; storePayerAuthorised: boolean; operationId: string; legalPolicyVersion: string }>): Promise<Readonly<{
    outcome: "SCHEDULED" | "REPLAY" | "RECONCILIATION_REQUIRED";
    contractReference: string; effectiveAt: Date; authorityReference?: string;
  }>>;
  loadProviderCancellation(input: Readonly<{ contractReference: string; operationId: string }>): Promise<Readonly<{
    outcome: "READY" | "REPLAY" | "NOT_REQUIRED" | "RECONCILIATION_REQUIRED";
    providerAuthority?: RecurringProviderAuthority;
  }>>;
  persistProviderCancellation(input: Readonly<{ contractReference: string; operationId: string; status: SubscriptionProviderStatus; safeEvidence: Record<string, string> }>): Promise<Readonly<{ outcome: "APPLIED" | "REPLAY" | "RECONCILIATION_REQUIRED" }>>;
  applyEffectiveCancellation(input: Readonly<{ contractReference: string; operationId: string; at: Date }>): Promise<Readonly<{
    outcome: "CANCELLED" | "REPLAY" | "NOT_DUE" | "RECONCILIATION_REQUIRED";
    expiredGrantCount?: number; cancelledJobCount?: number;
  }>>;
}>;

export async function requestSubscriptionCancellation(
  repository: SubscriptionCancellationRepository,
  input: Readonly<{ contractReference: string; payerUserId: string; storePayerAuthorised: boolean; operationId: string; legalPolicyVersion: string }>,
) {
  if (!input.operationId.trim()) throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "A cancellation operation ID is required.");
  const result = await repository.requestRollingCancellation(input);
  return Object.freeze({
    contractReference: result.contractReference,
    status: "CANCELLATION_SCHEDULED" as const,
    effectiveAt: result.effectiveAt.toISOString(),
    replayed: result.outcome === "REPLAY",
    reconciliationRequired: result.outcome === "RECONCILIATION_REQUIRED",
  });
}

/** Provider work occurs outside the request transaction; UNKNOWN is durable evidence, never assumed cancelled. */
export async function synchronizeProviderCancellation(
  repository: SubscriptionCancellationRepository,
  provider: PayfastRecurringProtocol,
  input: Readonly<{ contractReference: string; operationId: string; testApproval?: { approved: true } }>,
) {
  const prepared = await repository.loadProviderCancellation(input);
  if (prepared.outcome !== "READY") return Object.freeze({ outcome: prepared.outcome });
  if (!prepared.providerAuthority) throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "Cancellation has no provider authority.");
  assertSubscriptionsProductionReady("CANCELLATION_PROVIDER_MUTATION", input.testApproval);
  let result: Readonly<{ status: SubscriptionProviderStatus; safeEvidence: Record<string, string> }>;
  try {
    result = await provider.cancelRecurringAuthority({ ...prepared.providerAuthority, operationId: input.operationId });
  } catch (error) {
    await repository.persistProviderCancellation({ contractReference: input.contractReference, operationId: input.operationId, status: "UNKNOWN", safeEvidence: { outcome: "UNKNOWN", error: error instanceof Error ? error.name : "provider_failure" } });
    return Object.freeze({ outcome: "RECONCILIATION_REQUIRED" as const });
  }
  const persisted = await repository.persistProviderCancellation({ contractReference: input.contractReference, operationId: input.operationId, status: result.status, safeEvidence: result.safeEvidence });
  return Object.freeze({ outcome: persisted.outcome, providerStatus: result.status });
}

/** Executes only at the paid-period boundary; it cannot create invoices or remove usage history. */
export async function applySubscriptionCancellation(
  repository: SubscriptionCancellationRepository,
  input: Readonly<{ contractReference: string; operationId: string; at?: Date }>,
) {
  if (!input.operationId.trim()) throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "A cancellation operation ID is required.");
  return repository.applyEffectiveCancellation({ ...input, at: input.at ?? new Date() });
}
