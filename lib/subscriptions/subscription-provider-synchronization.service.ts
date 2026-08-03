import { SubscriptionError } from "@/lib/subscriptions/errors";
import { assertSubscriptionsProductionReady } from "@/lib/subscriptions/production-lock";
import type { PayfastRecurringProtocol, RecurringProviderAuthority, SubscriptionProviderStatus } from "@/lib/subscriptions/providers/recurring-payment-provider";

export type SubscriptionProviderSynchronizationRepository = Readonly<{
  /** Locks authority and contract before any network work and returns no token. */
  prepareSynchronization(input: Readonly<{ authorityReference: string; operationId: string }>): Promise<Readonly<{
    outcome: "READY" | "REPLAY" | "RECONCILIATION_REQUIRED";
    providerAuthority?: RecurringProviderAuthority;
    internalStatus?: "PENDING" | "ACTIVE" | "PAUSED" | "CANCELLED" | "RECONCILIATION_REQUIRED";
  }>>;
  persistSynchronization(input: Readonly<{
    authorityReference: string; operationId: string; observedStatus: SubscriptionProviderStatus;
    safeEvidence: Record<string, string>;
  }>): Promise<Readonly<{ outcome: "SYNCHRONIZED" | "REPLAY" | "RECONCILIATION_REQUIRED" }>>;
  openSynchronizationReconciliation(input: Readonly<{ authorityReference: string; operationId: string; reason: string }>): Promise<void>;
}>;

/**
 * Fetches provider state only through the concrete recurring adapter. The
 * encrypted provider token never crosses this boundary; adapters may decrypt
 * their own opaque authority material only when their protocol requires it.
 */
export async function synchronizeSubscriptionProviderAuthority(
  repository: SubscriptionProviderSynchronizationRepository,
  provider: PayfastRecurringProtocol,
  input: Readonly<{ authorityReference: string; operationId: string; testApproval?: { approved: true } }>,
) {
  if (!input.operationId.trim()) throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "A provider synchronization operation ID is required.");
  const prepared = await repository.prepareSynchronization(input);
  if (prepared.outcome !== "READY") return Object.freeze({ outcome: prepared.outcome });
  if (!prepared.providerAuthority) {
    await repository.openSynchronizationReconciliation({ ...input, reason: "PROVIDER_AUTHORITY_MISSING" });
    return Object.freeze({ outcome: "RECONCILIATION_REQUIRED" as const });
  }
  assertSubscriptionsProductionReady("PROVIDER_SYNCHRONIZATION", input.testApproval);
  let observed: Readonly<{ status: SubscriptionProviderStatus; safeEvidence: Record<string, string> }>;
  try {
    observed = await provider.synchronizeRecurringAuthority(prepared.providerAuthority);
  } catch (error) {
    await repository.openSynchronizationReconciliation({ ...input, reason: error instanceof SubscriptionError ? error.code : "PROVIDER_STATUS_UNKNOWN" });
    return Object.freeze({ outcome: "RECONCILIATION_REQUIRED" as const });
  }
  const result = await repository.persistSynchronization({ ...input, observedStatus: observed.status, safeEvidence: observed.safeEvidence });
  if (result.outcome === "RECONCILIATION_REQUIRED") await repository.openSynchronizationReconciliation({ ...input, reason: "PROVIDER_STATUS_MISMATCH" });
  return Object.freeze({ outcome: result.outcome, observedStatus: observed.status });
}
