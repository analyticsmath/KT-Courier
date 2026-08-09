import type { LedgerActor, PostLedgerJournalInput } from "@/lib/ledger/types";
import type { RefundFundingPlanItem } from "./refund-funding-policy";
import type { RefundMethodCode, RefundReasonCodeValue } from "./types";

type RefundPostingIdentity = Readonly<{
  refundReference: string;
  paymentReference: string;
  amount: string;
  actorUserId?: string;
}>;

function ledgerActor(actorUserId?: string): LedgerActor {
  return actorUserId ? { kind: "USER", userId: actorUserId } : { kind: "SYSTEM" };
}

export function refundReservePosting(input: RefundPostingIdentity & Readonly<{
  heldAccountId: string;
  method: RefundMethodCode;
  reasonCode: RefundReasonCodeValue;
  funding: readonly RefundFundingPlanItem[];
}>): PostLedgerJournalInput {
  return Object.freeze({
    idempotencyKey: `refund:${input.refundReference}:reserve:v1`,
    type: "REFUND_RESERVE",
    currency: "ZAR",
    sourceReference: `refund:${input.refundReference}:reserve`,
    correlationId: input.refundReference,
    memo: `Refund ${input.refundReference} funds reserved`,
    metadata: {
      refundReference: input.refundReference,
      paymentReference: input.paymentReference,
      method: input.method,
      reasonCode: input.reasonCode,
      fundingAllocationReferences: input.funding.map((item) => item.publicReference),
      commissionAllocationReferences: input.funding.flatMap((item) => item.commissionAllocationReference ? [item.commissionAllocationReference] : []),
    },
    actor: ledgerActor(input.actorUserId),
    entries: Object.freeze([
      ...input.funding.map((item, index) => Object.freeze({ accountId: item.ledgerAccountId, direction: "DEBIT" as const, amount: item.amount, lineCode: `REFUND-SOURCE-${index + 1}` })),
      Object.freeze({ accountId: input.heldAccountId, direction: "CREDIT" as const, amount: input.amount, lineCode: "REFUND-HELD" }),
    ]),
  });
}

export function refundReleasePosting(input: RefundPostingIdentity & Readonly<{
  heldAccountId: string;
  funding: readonly RefundFundingPlanItem[];
}>): PostLedgerJournalInput {
  return Object.freeze({
    idempotencyKey: `refund:${input.refundReference}:release:v1`,
    type: "REFUND_RELEASE",
    currency: "ZAR",
    sourceReference: `refund:${input.refundReference}:release`,
    correlationId: input.refundReference,
    memo: `Refund ${input.refundReference} reservation released`,
    metadata: { refundReference: input.refundReference, paymentReference: input.paymentReference, fundingAllocationReferences: input.funding.map((item) => item.publicReference) },
    actor: ledgerActor(input.actorUserId),
    entries: Object.freeze([
      Object.freeze({ accountId: input.heldAccountId, direction: "DEBIT" as const, amount: input.amount, lineCode: "REFUND-HELD" }),
      ...input.funding.map((item, index) => Object.freeze({ accountId: item.ledgerAccountId, direction: "CREDIT" as const, amount: item.amount, lineCode: `REFUND-SOURCE-${index + 1}` })),
    ]),
  });
}

export function refundWalletCreditPosting(input: RefundPostingIdentity & Readonly<{ heldAccountId: string; walletAvailableAccountId: string }>): PostLedgerJournalInput {
  return Object.freeze({
    idempotencyKey: `refund:${input.refundReference}:wallet-credit:v1`,
    type: "REFUND_WALLET_CREDIT",
    currency: "ZAR",
    sourceReference: `refund:${input.refundReference}:wallet-credit`,
    correlationId: input.refundReference,
    memo: `Refund ${input.refundReference} credited to customer wallet`,
    metadata: { refundReference: input.refundReference, paymentReference: input.paymentReference, method: "CUSTOMER_WALLET" },
    actor: ledgerActor(input.actorUserId),
    entries: Object.freeze([
      Object.freeze({ accountId: input.heldAccountId, direction: "DEBIT", amount: input.amount, lineCode: "REFUND-HELD" }),
      Object.freeze({ accountId: input.walletAvailableAccountId, direction: "CREDIT", amount: input.amount, lineCode: "CUSTOMER-WALLET" }),
    ]),
  });
}

export function refundExternalPayoutPosting(input: RefundPostingIdentity & Readonly<{ heldAccountId: string; cashClearingAccountId: string; attemptReference: string; providerRefundId: string }>): PostLedgerJournalInput {
  return Object.freeze({
    idempotencyKey: `refund:${input.refundReference}:external-payout:v1`,
    type: "REFUND_EXTERNAL_PAYOUT",
    currency: "ZAR",
    sourceReference: `refund:${input.refundReference}:external-payout`,
    correlationId: input.refundReference,
    memo: `Refund ${input.refundReference} repaid to original payment method`,
    metadata: { refundReference: input.refundReference, paymentReference: input.paymentReference, method: "ORIGINAL_PAYMENT_METHOD", attemptReference: input.attemptReference, providerRefundId: input.providerRefundId },
    actor: ledgerActor(input.actorUserId),
    entries: Object.freeze([
      Object.freeze({ accountId: input.heldAccountId, direction: "DEBIT", amount: input.amount, lineCode: "REFUND-HELD" }),
      Object.freeze({ accountId: input.cashClearingAccountId, direction: "CREDIT", amount: input.amount, lineCode: "CASH-CLEARING" }),
    ]),
  });
}
