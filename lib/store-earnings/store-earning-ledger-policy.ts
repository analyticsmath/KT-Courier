import type { PostLedgerJournalInput } from "@/lib/ledger/types";

type Actor = Readonly<{ actorUserId?: string }>;

function actor(input: Actor) {
  return input.actorUserId ? { kind: "USER" as const, userId: input.actorUserId } : { kind: "SYSTEM" as const };
}

export function storeEarningAccrualPosting(input: Readonly<{
  earningReference: string;
  amount: string;
  customerFundsHeldAccountId: string;
  storePayableAccountId: string;
  storePublicReference: string;
  subjectPublicReference: string;
  settlementVersion: string;
  paymentPublicReference: string;
}> & Actor): PostLedgerJournalInput {
  return Object.freeze({
    idempotencyKey: `store-earning:${input.earningReference}:accrue:v1`,
    sourceReference: `store-earning:${input.earningReference}:accrue`,
    type: "STORE_EARNING_ACCRUAL",
    currency: "ZAR",
    actor: actor(input),
    memo: `Store earning accrual ${input.earningReference}`,
    metadata: { earningReference: input.earningReference, storeReference: input.storePublicReference, subjectReference: input.subjectPublicReference, settlementVersion: input.settlementVersion, paymentReference: input.paymentPublicReference },
    entries: Object.freeze([
      { accountId: input.customerFundsHeldAccountId, direction: "DEBIT" as const, amount: input.amount, lineCode: "CUSTOMER_FUNDS_HELD" },
      { accountId: input.storePayableAccountId, direction: "CREDIT" as const, amount: input.amount, lineCode: "STORE_EARNINGS_PAYABLE" },
    ]),
  });
}

export function storeEarningReleasePosting(input: Readonly<{
  earningReference: string;
  amount: string;
  storePayableAccountId: string;
  ownerWithdrawableAccountId: string;
  storePublicReference: string;
  subjectPublicReference: string;
  settlementVersion: string;
  paymentPublicReference: string;
  releaseEligibleAt: string;
}> & Actor): PostLedgerJournalInput {
  return Object.freeze({
    idempotencyKey: `store-earning:${input.earningReference}:release:v1`,
    sourceReference: `store-earning:${input.earningReference}:release`,
    type: "STORE_EARNING_RELEASE",
    currency: "ZAR",
    actor: actor(input),
    memo: `Store earning release ${input.earningReference}`,
    metadata: { earningReference: input.earningReference, storeReference: input.storePublicReference, subjectReference: input.subjectPublicReference, settlementVersion: input.settlementVersion, paymentReference: input.paymentPublicReference, releaseEligibleAt: input.releaseEligibleAt },
    entries: Object.freeze([
      { accountId: input.storePayableAccountId, direction: "DEBIT" as const, amount: input.amount, lineCode: "STORE_EARNINGS_PAYABLE" },
      { accountId: input.ownerWithdrawableAccountId, direction: "CREDIT" as const, amount: input.amount, lineCode: "OWNER_WITHDRAWABLE" },
    ]),
  });
}

export function storeEarningReversalPosting(input: Readonly<{
  earningReference: string;
  amount: string;
  storePayableAccountId: string;
  customerFundsHeldAccountId: string;
  storePublicReference: string;
  subjectPublicReference: string;
  settlementVersion: string;
  reasonCode: string;
  operationId?: string;
}> & Actor): PostLedgerJournalInput {
  const suffix = input.operationId ? `:adjust:${input.operationId}` : ":reverse:v1";
  return Object.freeze({
    idempotencyKey: `store-earning:${input.earningReference}${suffix}`,
    sourceReference: `store-earning:${input.earningReference}${input.operationId ? ":adjust" : ":reverse"}`,
    type: "STORE_EARNING_REVERSAL",
    currency: "ZAR",
    actor: actor(input),
    memo: `Store earning reversal ${input.earningReference}`,
    metadata: { earningReference: input.earningReference, storeReference: input.storePublicReference, subjectReference: input.subjectPublicReference, settlementVersion: input.settlementVersion, reasonCode: input.reasonCode, operationId: input.operationId ?? null },
    entries: Object.freeze([
      { accountId: input.storePayableAccountId, direction: "DEBIT" as const, amount: input.amount, lineCode: "STORE_EARNINGS_PAYABLE" },
      { accountId: input.customerFundsHeldAccountId, direction: "CREDIT" as const, amount: input.amount, lineCode: "CUSTOMER_FUNDS_HELD" },
    ]),
  });
}
