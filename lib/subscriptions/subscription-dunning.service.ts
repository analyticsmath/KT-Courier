import { SubscriptionError } from "@/lib/subscriptions/errors";

export type SubscriptionDunningRepository = Readonly<{
  applyDunning(input: Readonly<{ operationId: string; now: Date }>): Promise<Readonly<{ outcome: "RETRY_SCHEDULED" | "GRACE_STARTED" | "SUSPENDED" | "RECONCILIATION_REQUIRED" | "REPLAY"; attempts: number; nextAttemptAt?: Date }>>;
}>;

/** Definite failures advance a bounded policy. UNKNOWN never calls the provider again and instead reconciles. */
export async function processSubscriptionDunning(repository: SubscriptionDunningRepository, input: Readonly<{ operationId: string; now?: Date; providerOutcome: "FAILED" | "UNKNOWN" }>) {
  if (input.providerOutcome === "UNKNOWN") return Object.freeze({ outcome: "RECONCILIATION_REQUIRED" as const, attempts: 0, safeReason: "UNKNOWN_PROVIDER_OUTCOME_NO_BLIND_RETRY" });
  const result = await repository.applyDunning({ operationId: input.operationId, now: input.now ?? new Date() });
  if (result.attempts < 0) throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "Dunning attempt evidence is invalid.");
  return result;
}
