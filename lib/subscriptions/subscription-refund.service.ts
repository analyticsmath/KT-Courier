import { Prisma } from "@prisma/client";
import { SubscriptionError } from "@/lib/subscriptions/errors";
import { prisma } from "@/lib/db/prisma";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { createRefundRequest } from "@/lib/services/refund-request.service";
import { subscriptionRefundReversalPosting } from "@/lib/subscriptions/subscription-ledger-policy";
import { createPrismaSubscriptionEntitlementRefundRepository } from "@/lib/subscriptions/prisma-subscription-lifecycle.repository";
import { applySubscriptionEntitlementRefundAdjustment } from "@/lib/subscriptions/subscription-entitlement-refund.service";

export type SubscriptionRefundReason =
  | "DUPLICATE_CHARGE"
  | "ERRONEOUS_CHARGE"
  | "COOLING_OFF_RESCISSION"
  | "ACTIVATION_FAILURE"
  | "PROVIDER_RECONCILIATION"
  | "SERVICE_UNAVAILABLE"
  | "LEGAL_REMEDY";

export type SubscriptionRefundRepository = Readonly<{
  /** Locks the invoice, cycle and successful Phase 12 Payment together. */
  resolvePaidInvoice(input: Readonly<{ invoiceReference: string; payerUserId: string }>): Promise<Readonly<{
    invoiceId: string; billingCycleId: string; contractId: string; paymentId: string;
    paymentReference: string; total: string; settledAmount: string; currency: "ZAR";
  }> | null>;
  /** This is Phase 15's canonical aggregate; no subscription refund exists. */
  requestPhase15Refund(input: Readonly<{ paymentId: string; payerUserId: string; amount: string; reason: SubscriptionRefundReason; operationId: string }>): Promise<Readonly<{ refundReference: string }>>;
  loadRefundAdjustmentState(input: Readonly<{ invoiceId: string; refundReference: string }>): Promise<Readonly<{
    settlementAmount: string; cumulativeRefundAmount: string; priorAdjustmentAmount: string;
    deferredAmount: string; recognizedAmount: string; taxAmount: string; authoritativeTax: boolean;
  }>>;
  applyFinancialReversal(input: Readonly<{
    invoiceId: string; billingCycleId: string; contractId: string; refundReference: string;
    deferredAmount: string; recognizedAmount: string; taxAmount: string; operationId: string;
  }>): Promise<Readonly<{ outcome: "APPLIED" | "REPLAY" | "RECONCILIATION_REQUIRED"; journalReference?: string }>>;
  reconcileEntitlementsAfterRefund(input: Readonly<{ invoiceId: string; refundReference: string; operationId: string }>): Promise<Readonly<{ outcome: "ADJUSTED" | "REPLAY" | "RECONCILIATION_REQUIRED" }>>;
  openRefundReconciliation(input: Readonly<{ invoiceId: string; refundReference: string; reason: string; operationId: string }>): Promise<void>;
}>;

export type SubscriptionRefundAllocation = Readonly<{ deferredAmount: string; recognizedAmount: string; taxAmount: string; totalAmount: string }>;

const decimal = (value: string) => {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "Subscription refund evidence contains an invalid money value.");
  return new Prisma.Decimal(value);
};

/**
 * Deterministically allocates a Phase 15 refund against the remaining
 * subscription settlement. Unrecognised service value is reversed first,
 * then recognised revenue. Tax is deliberately excluded unless the caller
 * has separate authoritative tax evidence.
 */
export function allocateSubscriptionRefundReversal(input: Readonly<{
  settlementAmount: string; cumulativeRefundAmount: string; priorAdjustmentAmount: string;
  deferredAmount: string; recognizedAmount: string; taxAmount: string; authoritativeTax: boolean;
}>): SubscriptionRefundAllocation {
  const settlement = decimal(input.settlementAmount);
  const cumulative = decimal(input.cumulativeRefundAmount);
  const prior = decimal(input.priorAdjustmentAmount);
  const deferred = decimal(input.deferredAmount);
  const recognized = decimal(input.recognizedAmount);
  const tax = decimal(input.taxAmount);
  if (cumulative.greaterThan(settlement) || prior.greaterThan(cumulative) || deferred.lessThan(0) || recognized.lessThan(0) || tax.lessThan(0)) {
    throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "Subscription refund exceeds coherent settlement evidence.");
  }
  const adjustment = cumulative.minus(prior);
  if (adjustment.lessThan(0) || adjustment.greaterThan(deferred.plus(recognized).plus(input.authoritativeTax ? tax : 0))) {
    throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "Subscription refund cannot be allocated to settled service value.");
  }
  const deferredPart = Prisma.Decimal.min(adjustment, deferred);
  const recognizedPart = Prisma.Decimal.min(adjustment.minus(deferredPart), recognized);
  const taxPart = input.authoritativeTax ? adjustment.minus(deferredPart).minus(recognizedPart) : new Prisma.Decimal(0);
  if (taxPart.lessThan(0) || taxPart.greaterThan(tax)) throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "Subscription tax reversal lacks authoritative evidence.");
  return Object.freeze({
    deferredAmount: deferredPart.toDecimalPlaces(2).toFixed(2),
    recognizedAmount: recognizedPart.toDecimalPlaces(2).toFixed(2),
    taxAmount: taxPart.toDecimalPlaces(2).toFixed(2),
    totalAmount: adjustment.toDecimalPlaces(2).toFixed(2),
  });
}

/** Reuses Phase 15; it neither completes the provider refund nor mutates balances. */
export async function requestSubscriptionRefund(repository: SubscriptionRefundRepository, input: Readonly<{ invoiceReference: string; payerUserId: string; reason: SubscriptionRefundReason; operationId: string }>) {
  const invoice = await repository.resolvePaidInvoice(input);
  if (!invoice) throw new SubscriptionError("SUBSCRIPTION_ACCESS_DENIED", "Paid membership invoice is not available to this payer.");
  const refund = await repository.requestPhase15Refund({ paymentId: invoice.paymentId, payerUserId: input.payerUserId, amount: invoice.total, reason: input.reason, operationId: input.operationId });
  return applySubscriptionRefundAdjustment(repository, { ...invoice, refundReference: refund.refundReference, operationId: input.operationId });
}

/**
 * Canonical post-request composition. It makes immutable accounting and
 * entitlement evidence, but never treats a provider refund as successful.
 */
export async function applySubscriptionRefundAdjustment(repository: SubscriptionRefundRepository, input: Readonly<{
  invoiceId: string; billingCycleId: string; contractId: string; paymentId: string; paymentReference: string;
  total: string; settledAmount: string; currency: "ZAR"; refundReference: string; operationId: string;
}>) {
  const state = await repository.loadRefundAdjustmentState({ invoiceId: input.invoiceId, refundReference: input.refundReference });
  const allocation = allocateSubscriptionRefundReversal(state);
  const accounting = await repository.applyFinancialReversal({
    invoiceId: input.invoiceId, billingCycleId: input.billingCycleId, contractId: input.contractId,
    refundReference: input.refundReference, ...allocation, operationId: input.operationId,
  });
  if (accounting.outcome === "RECONCILIATION_REQUIRED") {
    await repository.openRefundReconciliation({ invoiceId: input.invoiceId, refundReference: input.refundReference, reason: "REFUND_ACCOUNTING_INCOHERENT", operationId: input.operationId });
    return Object.freeze({ outcome: "RECONCILIATION_REQUIRED" as const, refundReference: input.refundReference });
  }
  const entitlements = await repository.reconcileEntitlementsAfterRefund({ invoiceId: input.invoiceId, refundReference: input.refundReference, operationId: input.operationId });
  if (entitlements.outcome === "RECONCILIATION_REQUIRED") {
    await repository.openRefundReconciliation({ invoiceId: input.invoiceId, refundReference: input.refundReference, reason: "REFUND_ENTITLEMENT_MISMATCH", operationId: input.operationId });
  }
  return Object.freeze({
    outcome: entitlements.outcome === "RECONCILIATION_REQUIRED" ? "RECONCILIATION_REQUIRED" as const : accounting.outcome,
    refundReference: input.refundReference,
    allocation,
    ...(accounting.journalReference ? { journalReference: accounting.journalReference } : {}),
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any -- generated Phase 22 client validation is deferred. */
const db = prisma as any;
const safe = (prefix: string, value: string) => `${prefix}_${value.replace(/[^A-Za-z0-9_-]/g, "").slice(-48)}`;
const phase15Reason = (reason: SubscriptionRefundReason) => reason === "DUPLICATE_CHARGE" ? "DUPLICATE_PAYMENT" as const : reason === "SERVICE_UNAVAILABLE" || reason === "ACTIVATION_FAILURE" ? "SERVICE_FAILURE" as const : "OTHER_REVIEWED" as const;

/** Concrete Phase 15 composition and immutable subscription accounting link. */
export function createPrismaSubscriptionRefundRepository(database: any = db): SubscriptionRefundRepository {
  return Object.freeze({
    async resolvePaidInvoice(input) {
      return database.$transaction(async (tx: any) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionInvoice" WHERE "publicReference" = ${input.invoiceReference} AND "payerUserId" = ${input.payerUserId} FOR UPDATE`);
        const invoice = await tx.subscriptionInvoice.findFirst({ where: { publicReference: input.invoiceReference, payerUserId: input.payerUserId }, include: { billingCycle: true, contract: true, payment: true, settlement: true } });
        if (!invoice?.payment || !invoice.settlement || invoice.payment.status !== "SUCCEEDED" || invoice.status !== "PAID" || invoice.billingCycle.status !== "PAID") return null;
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionContract" WHERE "id" = ${invoice.contractId} FOR UPDATE`);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionBillingCycle" WHERE "id" = ${invoice.billingCycleId} FOR UPDATE`);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${invoice.payment.id} FOR UPDATE`);
        return { invoiceId: invoice.id, billingCycleId: invoice.billingCycleId, contractId: invoice.contractId, paymentId: invoice.payment.id, paymentReference: invoice.payment.publicReference, total: invoice.total.toFixed(2), settledAmount: invoice.settlement.settledAmount.toFixed(2), currency: "ZAR" as const };
      });
    },
    async requestPhase15Refund(input) {
      const payment = await database.payment.findUnique({ where: { id: input.paymentId }, select: { publicReference: true } });
      if (!payment) throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "Subscription payment no longer exists for Phase 15 refund composition.");
      const refund = await createRefundRequest({ actorUserId: input.payerUserId, paymentPublicReference: payment.publicReference, amount: input.amount, method: "ORIGINAL_PAYMENT_METHOD", reasonCode: phase15Reason(input.reason), operationId: input.operationId });
      return { refundReference: refund.publicReference };
    },
    async loadRefundAdjustmentState(input) {
      const [invoice, refund] = await Promise.all([
        database.subscriptionInvoice.findUnique({ where: { id: input.invoiceId }, include: { settlement: true, revenueSchedule: { include: { entries: true } } } }),
        database.paymentRefund.findUnique({ where: { publicReference: input.refundReference } }),
      ]);
      if (!invoice?.settlement || !refund) throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "Subscription refund lacks settlement or Phase 15 evidence.");
      const previous = await database.subscriptionRefundAdjustment.aggregate({ where: { invoiceId: invoice.id }, _sum: { deferredAmount: true, recognizedAmount: true, taxAmount: true } });
      const priorAdjustmentAmount = new Prisma.Decimal(previous._sum.deferredAmount ?? 0).plus(previous._sum.recognizedAmount ?? 0).plus(previous._sum.taxAmount ?? 0);
      const recognized = invoice.revenueSchedule?.recognizedAmount ?? new Prisma.Decimal(0);
      const deferred = new Prisma.Decimal(invoice.settlement.netAmount).minus(recognized).minus(previous._sum.deferredAmount ?? 0);
      return { settlementAmount: invoice.settlement.settledAmount.toFixed(2), cumulativeRefundAmount: refund.amount.toFixed(2), priorAdjustmentAmount: priorAdjustmentAmount.toFixed(2), deferredAmount: Prisma.Decimal.max(0, deferred).toFixed(2), recognizedAmount: Prisma.Decimal.max(0, new Prisma.Decimal(recognized).minus(previous._sum.recognizedAmount ?? 0)).toFixed(2), taxAmount: invoice.settlement.taxAmount.toFixed(2), authoritativeTax: invoice.settlement.taxAmount.greaterThan(0) };
    },
    async applyFinancialReversal(input) {
      return database.$transaction(async (tx: any) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionInvoice" WHERE "id" = ${input.invoiceId} FOR UPDATE`);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionBillingCycle" WHERE "id" = ${input.billingCycleId} FOR UPDATE`);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionContract" WHERE "id" = ${input.contractId} FOR UPDATE`);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentRefund" WHERE "publicReference" = ${input.refundReference} FOR UPDATE`);
        const existing = await tx.subscriptionRefundAdjustment.findUnique({ where: { operationId: input.operationId } });
        if (existing) return { outcome: "REPLAY" as const, journalReference: existing.ledgerJournalId ?? undefined };
        const [invoice, refund, accounts] = await Promise.all([
          tx.subscriptionInvoice.findUnique({ where: { id: input.invoiceId } }), tx.paymentRefund.findUnique({ where: { publicReference: input.refundReference } }),
          tx.ledgerAccount.findMany({ where: { wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" }, code: { in: ["PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", "PLATFORM-SUBSCRIPTION-DEFERRED-REVENUE-ZAR", "PLATFORM-SUBSCRIPTION-REVENUE-ZAR", "PLATFORM-SUBSCRIPTION-TAX-PAYABLE-ZAR"] }, currency: "ZAR", status: "ACTIVE" } }),
        ]);
        const held = accounts.find((account: any) => account.code === "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" && account.purpose === "HELD");
        const deferred = accounts.find((account: any) => account.code === "PLATFORM-SUBSCRIPTION-DEFERRED-REVENUE-ZAR" && account.purpose === "SUBSCRIPTION_DEFERRED_REVENUE");
        const revenue = accounts.find((account: any) => account.code === "PLATFORM-SUBSCRIPTION-REVENUE-ZAR" && account.purpose === "PLATFORM_REVENUE");
        const tax = accounts.find((account: any) => account.code === "PLATFORM-SUBSCRIPTION-TAX-PAYABLE-ZAR" && account.purpose === "SUBSCRIPTION_TAX_PAYABLE");
        if (!invoice || !refund || !held || !deferred || !revenue || (input.taxAmount !== "0.00" && !tax)) return { outcome: "RECONCILIATION_REQUIRED" as const };
        const journal = await postLedgerJournalWithinTransaction(tx, subscriptionRefundReversalPosting({ invoiceReference: invoice.publicReference, refundReference: refund.publicReference, deferredAmount: input.deferredAmount, recognizedAmount: input.recognizedAmount, taxAmount: input.taxAmount, customerFundsHeldAccountId: held.id, deferredRevenueAccountId: deferred.id, subscriptionRevenueAccountId: revenue.id, ...(tax ? { taxPayableAccountId: tax.id } : {}) }));
        await tx.subscriptionRefundAdjustment.create({ data: { publicReference: safe("subrefadj", input.operationId), contractId: input.contractId, invoiceId: input.invoiceId, billingCycleId: input.billingCycleId, refundId: refund.id, operationId: input.operationId, deferredAmount: input.deferredAmount, recognizedAmount: input.recognizedAmount, taxAmount: input.taxAmount, ledgerJournalId: journal.id, safeEvidence: { refundReference: refund.publicReference, journalReference: journal.reference } } });
        return { outcome: "APPLIED" as const, journalReference: journal.reference };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
    async reconcileEntitlementsAfterRefund(input) {
      const result = await applySubscriptionEntitlementRefundAdjustment(createPrismaSubscriptionEntitlementRefundRepository(database), input);
      return result;
    },
    async openRefundReconciliation(input) {
      await database.subscriptionReconciliationCase.upsert({ where: { caseKey: `subscription-refund:${input.invoiceId}:${input.reason}` }, create: { publicReference: safe("subrec", `${input.invoiceId}_${input.reason}`), caseKey: `subscription-refund:${input.invoiceId}:${input.reason}`, invoiceId: input.invoiceId, reason: input.reason === "REFUND_ENTITLEMENT_MISMATCH" ? "REFUND_ENTITLEMENT_MISMATCH" : "APPLICATION_FAILURE", priority: "HIGH", safeSummary: "Subscription refund requires reconciliation.", safeEvidence: { refundReference: input.refundReference, operationId: input.operationId } }, update: { lastObservedAt: new Date() } });
    },
  });
}
