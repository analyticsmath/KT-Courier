import { WithdrawalError } from "./errors";

export const PAYOUT_ATTEMPT_STATUSES = ["RESERVED", "PROCESSING", "SUCCEEDED", "FAILED", "UNKNOWN"] as const;
export type PayoutAttemptStatusCode = (typeof PAYOUT_ATTEMPT_STATUSES)[number];

const transitions: Readonly<Record<PayoutAttemptStatusCode, readonly PayoutAttemptStatusCode[]>> = {
  RESERVED: ["PROCESSING"],
  PROCESSING: ["SUCCEEDED", "FAILED", "UNKNOWN"],
  SUCCEEDED: [],
  FAILED: [],
  UNKNOWN: [],
};

export function canTransitionPayoutAttempt(from: PayoutAttemptStatusCode, to: PayoutAttemptStatusCode): boolean {
  return transitions[from].includes(to);
}

export function assertPayoutAttemptTransition(from: PayoutAttemptStatusCode, to: PayoutAttemptStatusCode): void {
  if (!canTransitionPayoutAttempt(from, to)) {
    throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", `Payout attempt cannot transition from ${from} to ${to}.`);
  }
}
