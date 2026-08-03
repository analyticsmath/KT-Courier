import type { PostLedgerJournalInput } from "@/lib/ledger/types";
import { Prisma } from "@prisma/client";

export function subscriptionInvoiceSettlementPosting(input: Readonly<{ invoiceReference: string; paymentReference: string; amount: string; netAmount: string; taxAmount: string; customerFundsHeldAccountId: string; deferredRevenueAccountId: string; taxPayableAccountId?: string }>): PostLedgerJournalInput {
  const taxEntry = input.taxAmount !== "0.00"
    ? input.taxPayableAccountId
      ? [Object.freeze({ accountId: input.taxPayableAccountId, direction: "CREDIT" as const, amount: input.taxAmount, lineCode: "SUBSCRIPTION_TAX_PAYABLE", memo: "Authoritative subscription tax component" })]
      : (() => { throw new Error("Subscription tax account is required for authoritative tax evidence."); })()
    : [];
  return Object.freeze({
    idempotencyKey: `subscription:invoice:${input.invoiceReference}:settlement:v1`,
    sourceReference: `subscription:invoice:${input.invoiceReference}:settlement`,
    correlationId: input.paymentReference,
    type: "SUBSCRIPTION_INVOICE_SETTLEMENT",
    currency: "ZAR",
    memo: "Subscription payment reclassified from customer funds held to deferred revenue.",
    metadata: Object.freeze({ invoiceReference: input.invoiceReference, paymentReference: input.paymentReference, policyVersion: "subscription-settlement-v1" }),
    actor: Object.freeze({ kind: "SYSTEM" as const }),
    entries: Object.freeze([
      Object.freeze({ accountId: input.customerFundsHeldAccountId, direction: "DEBIT" as const, amount: input.amount, lineCode: "CUSTOMER_FUNDS_HELD", memo: "Settled subscription service value" }),
      Object.freeze({ accountId: input.deferredRevenueAccountId, direction: "CREDIT" as const, amount: input.netAmount, lineCode: "SUBSCRIPTION_DEFERRED_REVENUE", memo: "Subscription value deferred over the paid service period" }),
      ...taxEntry,
    ]),
  });
}

export function subscriptionRevenueRecognitionPosting(input: Readonly<{ invoiceReference: string; scheduleReference: string; recognitionDate: string; amount: string; deferredRevenueAccountId: string; subscriptionRevenueAccountId: string }>): PostLedgerJournalInput {
  return Object.freeze({
    idempotencyKey: `subscription:revenue:${input.scheduleReference}:${input.recognitionDate}:v1`,
    sourceReference: `subscription:revenue:${input.scheduleReference}:${input.recognitionDate}`,
    correlationId: input.invoiceReference,
    type: "SUBSCRIPTION_REVENUE_RECOGNITION",
    currency: "ZAR",
    memo: "Daily straight-line subscription revenue recognition.",
    metadata: Object.freeze({ invoiceReference: input.invoiceReference, scheduleReference: input.scheduleReference, recognitionDate: input.recognitionDate, policyVersion: "subscription-revenue-straight-line-v1" }),
    actor: Object.freeze({ kind: "SYSTEM" as const }),
    entries: Object.freeze([
      Object.freeze({ accountId: input.deferredRevenueAccountId, direction: "DEBIT" as const, amount: input.amount, lineCode: "SUBSCRIPTION_DEFERRED_REVENUE", memo: "Earned subscription service value" }),
      Object.freeze({ accountId: input.subscriptionRevenueAccountId, direction: "CREDIT" as const, amount: input.amount, lineCode: "SUBSCRIPTION_REVENUE", memo: "Recognized subscription revenue" }),
    ]),
  });
}

/**
 * Refund adjustments reverse only the portion of service value that has been
 * settled into deferred or recognised subscription revenue.  The Phase 15
 * refund aggregate remains the provider and customer-funds authority.
 */
export function subscriptionRefundReversalPosting(input: Readonly<{
  invoiceReference: string;
  refundReference: string;
  deferredAmount: string;
  recognizedAmount: string;
  taxAmount?: string;
  customerFundsHeldAccountId: string;
  deferredRevenueAccountId: string;
  subscriptionRevenueAccountId: string;
  taxPayableAccountId?: string;
}>): PostLedgerJournalInput {
  const entries = [
    ...(input.deferredAmount !== "0.00" ? [Object.freeze({ accountId: input.deferredRevenueAccountId, direction: "DEBIT" as const, amount: input.deferredAmount, lineCode: "SUBSCRIPTION_DEFERRED_REVENUE_REVERSAL", memo: "Refunded unrecognised subscription service value" })] : []),
    ...(input.recognizedAmount !== "0.00" ? [Object.freeze({ accountId: input.subscriptionRevenueAccountId, direction: "DEBIT" as const, amount: input.recognizedAmount, lineCode: "SUBSCRIPTION_REVENUE_REVERSAL", memo: "Refunded recognised subscription service value" })] : []),
    ...((input.taxAmount ?? "0.00") !== "0.00" ? input.taxPayableAccountId ? [Object.freeze({ accountId: input.taxPayableAccountId, direction: "DEBIT" as const, amount: input.taxAmount!, lineCode: "SUBSCRIPTION_TAX_REVERSAL", memo: "Authoritative subscription tax reversal" })] : (() => { throw new Error("Subscription tax reversal requires an authoritative tax account."); })() : []),
    Object.freeze({ accountId: input.customerFundsHeldAccountId, direction: "CREDIT" as const, amount: new Prisma.Decimal(input.deferredAmount).plus(input.recognizedAmount).plus(input.taxAmount ?? "0.00").toFixed(2), lineCode: "CUSTOMER_FUNDS_HELD_REFUND", memo: "Subscription refund funding evidence" }),
  ];
  return Object.freeze({
    idempotencyKey: `subscription:refund:${input.refundReference}:reversal:v1`,
    sourceReference: `subscription:invoice:${input.invoiceReference}:refund:${input.refundReference}`,
    correlationId: input.refundReference,
    type: "SUBSCRIPTION_REFUND_REVERSAL",
    currency: "ZAR",
    memo: "Subscription deferred and recognised revenue reversal for a Phase 15 refund.",
    metadata: Object.freeze({ invoiceReference: input.invoiceReference, refundReference: input.refundReference, policyVersion: "subscription-refund-reversal-v1" }),
    actor: Object.freeze({ kind: "SYSTEM" as const }),
    entries: Object.freeze(entries),
  });
}
