import { SubscriptionError } from "@/lib/subscriptions/errors";

export type SubscriptionEntitlementRefundRepository = Readonly<{
  adjustRefundedCycle(input: Readonly<{ invoiceId: string; refundReference: string; operationId: string }>): Promise<Readonly<{
    outcome: "ADJUSTED" | "REPLAY" | "RECONCILIATION_REQUIRED";
    revokedGrantCount: number; releasedReservationCount: number; consumedGrantCount: number;
  }>>;
}>;

/**
 * This narrow canonical boundary is shared by refund request, admin retry and
 * recovery processors. Usage rows are append-only: unconsumed allowance is
 * revoked, eligible active reservations are released, and consumed benefit
 * evidence is routed to reconciliation rather than rewritten.
 */
export async function applySubscriptionEntitlementRefundAdjustment(
  repository: SubscriptionEntitlementRefundRepository,
  input: Readonly<{ invoiceId: string; refundReference: string; operationId: string }>,
) {
  if (!input.operationId.trim()) throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "A refund entitlement operation ID is required.");
  return repository.adjustRefundedCycle(input);
}
