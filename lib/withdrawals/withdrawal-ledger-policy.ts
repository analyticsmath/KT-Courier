import type { PostLedgerJournalInput } from "@/lib/ledger/types";

type WithdrawalLedgerInput = Readonly<{
  withdrawalReference: string;
  amount: string;
  sourceAccountId: string;
  heldAccountId: string;
  cashClearingAccountId?: string;
  actorUserId: string;
  payoutAttemptReference?: string;
  payoutDestinationReference: string;
  ownerType: string;
  policyVersion: number;
}>;

const metadata = (input: WithdrawalLedgerInput) => ({
  withdrawalReference: input.withdrawalReference,
  payoutAttemptReference: input.payoutAttemptReference ?? null,
  payoutDestinationReference: input.payoutDestinationReference,
  ownerType: input.ownerType,
  withdrawalPolicyVersion: String(input.policyVersion),
});

export function withdrawalReservePosting(input: WithdrawalLedgerInput): PostLedgerJournalInput {
  return {
    idempotencyKey: `withdrawal:${input.withdrawalReference}:reserve:v1`,
    type: "WITHDRAWAL_RESERVE",
    currency: "ZAR",
    sourceReference: `withdrawal:${input.withdrawalReference}:reserve`,
    correlationId: input.withdrawalReference,
    memo: "Withdrawal funds reserved",
    metadata: metadata(input),
    actor: { kind: "USER", userId: input.actorUserId },
    entries: [
      { accountId: input.sourceAccountId, direction: "DEBIT", amount: input.amount, lineCode: "OWNER_WITHDRAWABLE_DEBIT", memo: "Withdrawable funds reserved" },
      { accountId: input.heldAccountId, direction: "CREDIT", amount: input.amount, lineCode: "WITHDRAWAL_HELD_CREDIT", memo: "Withdrawal funds held" },
    ],
  };
}

export function withdrawalReleasePosting(input: WithdrawalLedgerInput): PostLedgerJournalInput {
  return {
    idempotencyKey: `withdrawal:${input.withdrawalReference}:release:v1`,
    type: "WITHDRAWAL_RELEASE",
    currency: "ZAR",
    sourceReference: `withdrawal:${input.withdrawalReference}:release`,
    correlationId: input.withdrawalReference,
    memo: "Withdrawal reservation released",
    metadata: metadata(input),
    actor: { kind: "USER", userId: input.actorUserId },
    entries: [
      { accountId: input.heldAccountId, direction: "DEBIT", amount: input.amount, lineCode: "WITHDRAWAL_HELD_DEBIT", memo: "Withdrawal hold released" },
      { accountId: input.sourceAccountId, direction: "CREDIT", amount: input.amount, lineCode: "OWNER_WITHDRAWABLE_CREDIT", memo: "Withdrawable funds restored" },
    ],
  };
}

export function withdrawalPayoutPosting(input: WithdrawalLedgerInput): PostLedgerJournalInput {
  if (!input.cashClearingAccountId) throw new Error("A cash-clearing account is required for withdrawal payout posting.");
  return {
    idempotencyKey: `withdrawal:${input.withdrawalReference}:payout:v1`,
    type: "WITHDRAWAL_PAYOUT",
    currency: "ZAR",
    sourceReference: `withdrawal:${input.withdrawalReference}:payout`,
    correlationId: input.withdrawalReference,
    memo: "Manual external withdrawal payout recorded",
    metadata: metadata(input),
    actor: { kind: "USER", userId: input.actorUserId },
    entries: [
      { accountId: input.heldAccountId, direction: "DEBIT", amount: input.amount, lineCode: "WITHDRAWAL_HELD_DEBIT", memo: "Withdrawal liability settled" },
      { accountId: input.cashClearingAccountId, direction: "CREDIT", amount: input.amount, lineCode: "CASH_CLEARING_CREDIT", memo: "Manual external payout cash reduction" },
    ],
  };
}
