import { WithdrawalError } from "./errors";

export const WITHDRAWAL_STATUSES = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PROCESSING",
  "PAID",
  "REJECTED",
  "CANCELLED",
  "RECONCILIATION_REQUIRED",
] as const;

export type WithdrawalStatusCode = (typeof WITHDRAWAL_STATUSES)[number];

const transitions: Readonly<Record<WithdrawalStatusCode, readonly WithdrawalStatusCode[]>> = {
  REQUESTED: ["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PAID", "APPROVED", "RECONCILIATION_REQUIRED"],
  RECONCILIATION_REQUIRED: ["APPROVED", "PAID", "CANCELLED"],
  PAID: [],
  REJECTED: [],
  CANCELLED: [],
};

export function isWithdrawalStatus(value: string): value is WithdrawalStatusCode {
  return (WITHDRAWAL_STATUSES as readonly string[]).includes(value);
}

export function isWithdrawalTerminal(status: WithdrawalStatusCode): boolean {
  return transitions[status].length === 0;
}

export function canTransitionWithdrawal(from: WithdrawalStatusCode, to: WithdrawalStatusCode): boolean {
  return transitions[from].includes(to);
}

export function assertWithdrawalTransition(from: WithdrawalStatusCode, to: WithdrawalStatusCode): void {
  if (!canTransitionWithdrawal(from, to)) {
    throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", `Withdrawal cannot transition from ${from} to ${to}.`);
  }
}
