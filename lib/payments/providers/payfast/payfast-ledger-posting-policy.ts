import type { PostLedgerJournalInput } from "@/lib/ledger/types";

export function buildPayfastReceiptPosting(input: {
  paymentPublicReference: string;
  attemptPublicReference: string;
  eventPublicReference: string;
  providerPaymentId: string;
  amount: string;
  cashClearingAccountId: string;
  customerFundsHeldAccountId: string;
}): PostLedgerJournalInput {
  return Object.freeze({
    idempotencyKey: `payfast:payment:${input.paymentPublicReference}:complete:v1`,
    sourceReference: `payfast:payment:${input.paymentPublicReference}:complete`,
    correlationId: input.paymentPublicReference,
    type: "EXTERNAL_PAYMENT_RECEIPT",
    currency: "ZAR",
    memo: "South African Payfast gross payment received; customer service value remains held.",
    metadata: Object.freeze({
      paymentReference: input.paymentPublicReference,
      attemptReference: input.attemptPublicReference,
      webhookEventReference: input.eventPublicReference,
      providerPaymentId: input.providerPaymentId,
      provider: "PAYFAST",
      feePosting: "DEFERRED",
    }),
    actor: Object.freeze({ kind: "SYSTEM" as const }),
    entries: Object.freeze([
      Object.freeze({
        accountId: input.cashClearingAccountId,
        direction: "DEBIT" as const,
        amount: input.amount,
        lineCode: "PAYFAST_CASH_RECEIVED",
        memo: "Gross Payfast cash receipt",
      }),
      Object.freeze({
        accountId: input.customerFundsHeldAccountId,
        direction: "CREDIT" as const,
        amount: input.amount,
        lineCode: "CUSTOMER_FUNDS_HELD",
        memo: "Customer service value held pending fulfilment",
      }),
    ]),
  });
}
