import { assertPaymentSubjectIntegrity } from "@/lib/payments/payment-subject-policy";
import { SubscriptionError } from "@/lib/subscriptions/errors";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { subscriptionInvoiceSettlementPosting } from "@/lib/subscriptions/subscription-ledger-policy";
import { resolveSubscriptionProviderEvent } from "@/lib/subscriptions/subscription-provider-event-resolution.service";

export type SubscriptionPaymentSuccessHookRepository = Readonly<{
  getSuccessfulSubscriptionPayment(paymentId: string): Promise<Readonly<{ id: string; subjectType: "COURIER_ORDER" | "MARKETPLACE_CHECKOUT" | "SUBSCRIPTION_INVOICE"; userId: string | null; orderId: string | null; marketplaceCheckoutId: string | null; marketplaceOrderId: string | null; subscriptionInvoiceId: string | null; subscriptionInvoicePayerUserId: string | null; status: string; providerEvent?: Readonly<{ merchantInvoiceReference: string; preparedInvoiceReference: string; providerPaymentReference: string; previousProviderPaymentReference: string | null; providerTokenFingerprint: string | null; expectedTokenFingerprint: string | null; amount: string; invoiceAmount: string; currency: string; invoiceCurrency: string; providerEnvironment: "SANDBOX" | "PRODUCTION"; preparedEnvironment: "SANDBOX" | "PRODUCTION"; cycleNumber: number; invoiceStatus: "ISSUED" | "PAID" | "VOID" | "REFUNDED" }> }> | null>;
  settleAndActivatePaidInvoice(input: Readonly<{ paymentId: string; invoiceId: string; operationId: string }>): Promise<Readonly<{ outcome: "ACTIVATED" | "DUPLICATE" | "RECONCILIATION_REQUIRED" }>>;
  openApplicationReconciliation(input: Readonly<{ paymentId: string; invoiceId: string; reason: string }>): Promise<void>;
}>;

/**
 * Invoked only from Phase 12's post-commit verified-success callback. It
 * cannot be reached by a return page, customer API, or admin mutation.
 */
export async function onVerifiedSubscriptionPaymentSucceeded(repository: SubscriptionPaymentSuccessHookRepository, paymentId: string): Promise<void> {
  const payment = await repository.getSuccessfulSubscriptionPayment(paymentId);
  if (!payment || payment.subjectType !== "SUBSCRIPTION_INVOICE") return;
  assertPaymentSubjectIntegrity(payment);
  if (payment.status !== "SUCCEEDED" || !payment.subscriptionInvoiceId) throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "Verified payment is not coherent with its subscription invoice.");
  // Phase 12 has already verified the ITN, but activation still requires the
  // immutable subscription projection of that exact event. A successful
  // Payment without this evidence remains successful and held for recovery.
  if (!payment.providerEvent) {
    await repository.openApplicationReconciliation({ paymentId: payment.id, invoiceId: payment.subscriptionInvoiceId, reason: "PROVIDER_EVENT_MISSING" });
    return;
  }
  const event = payment.providerEvent;
  const classification = resolveSubscriptionProviderEvent({
    merchantInvoiceReference: event.merchantInvoiceReference,
    preparedInvoiceReference: event.preparedInvoiceReference,
    providerPaymentReference: event.providerPaymentReference,
    previousProviderPaymentReference: event.previousProviderPaymentReference,
    // The Phase 12 receipt retains only the fingerprint, never its raw token.
    providerToken: null,
    expectedTokenFingerprint: null,
    payerUserId: payment.userId ?? "",
    invoicePayerUserId: payment.subscriptionInvoicePayerUserId ?? "",
    amount: event.amount,
    invoiceAmount: event.invoiceAmount,
    currency: event.currency,
    invoiceCurrency: event.invoiceCurrency,
    providerEnvironment: event.providerEnvironment,
    preparedEnvironment: event.preparedEnvironment,
    cycleNumber: event.cycleNumber,
    invoiceStatus: event.invoiceStatus,
  });
  const tokenMismatch = Boolean(event.expectedTokenFingerprint && event.providerTokenFingerprint !== event.expectedTokenFingerprint);
  if (classification === "RECONCILIATION_REQUIRED" || tokenMismatch) {
    await repository.openApplicationReconciliation({ paymentId: payment.id, invoiceId: payment.subscriptionInvoiceId, reason: tokenMismatch ? "PROVIDER_TOKEN_MISMATCH" : "PROVIDER_EVENT_MISMATCH" });
    return;
  }
  if (classification === "DUPLICATE") return;
  try {
    const result = await repository.settleAndActivatePaidInvoice({ paymentId: payment.id, invoiceId: payment.subscriptionInvoiceId, operationId: `subscription-activation:${payment.id}` });
    if (result.outcome === "RECONCILIATION_REQUIRED") await repository.openApplicationReconciliation({ paymentId: payment.id, invoiceId: payment.subscriptionInvoiceId, reason: "PAYMENT_SUCCEEDED_CONTRACT_INACTIVE" });
  } catch {
    await repository.openApplicationReconciliation({ paymentId: payment.id, invoiceId: payment.subscriptionInvoiceId, reason: "APPLICATION_FAILURE" });
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 22 schema generation is deferred. */
const db = prisma as any;
const safeReference = (prefix: string, value: string) => `${prefix}_${value.replace(/[^A-Za-z0-9_-]/g, "").slice(-36)}`;

export function createPrismaSubscriptionPaymentSuccessHookRepository(database: any = db): SubscriptionPaymentSuccessHookRepository {
  return Object.freeze({
    async getSuccessfulSubscriptionPayment(paymentId) {
      const payment = await database.payment.findUnique({ where: { id: paymentId }, include: { successfulAttempt: true, successWebhookEvent: true, subscriptionInvoice: { include: { billingCycle: true, contract: { include: { paymentAuthority: true } } } } } });
      if (!payment) return null;
      const invoice = payment.subscriptionInvoice;
      const event = payment.successWebhookEvent;
      const tokenFingerprint = typeof event?.safePayloadSnapshot === "object" && event.safePayloadSnapshot && !Array.isArray(event.safePayloadSnapshot)
        ? (event.safePayloadSnapshot as Record<string, unknown>).recurringTokenFingerprint
        : null;
      const providerEvent = invoice && event && payment.successfulAttempt?.providerReference
        ? {
            merchantInvoiceReference: event.merchantReference,
            preparedInvoiceReference: invoice.publicReference,
            providerPaymentReference: payment.successfulAttempt.providerReference,
            previousProviderPaymentReference: invoice.status === "PAID" ? payment.successfulAttempt.providerReference : null,
            providerTokenFingerprint: typeof tokenFingerprint === "string" ? tokenFingerprint : null,
            expectedTokenFingerprint: invoice.contract.paymentAuthority?.providerTokenFingerprint ?? null,
            amount: payment.amount.toFixed(2), invoiceAmount: invoice.total.toFixed(2), currency: payment.currency, invoiceCurrency: invoice.currency,
            providerEnvironment: event.environment, preparedEnvironment: payment.successfulAttempt.providerEnvironment,
            cycleNumber: invoice.billingCycle.cycleNumber, invoiceStatus: invoice.status,
          } as const
        : undefined;
      return { id: payment.id, subjectType: payment.subjectType, userId: payment.userId, orderId: payment.orderId, marketplaceCheckoutId: payment.marketplaceCheckoutId, marketplaceOrderId: payment.marketplaceOrderId, subscriptionInvoiceId: payment.subscriptionInvoiceId, subscriptionInvoicePayerUserId: invoice?.payerUserId ?? null, status: payment.status, ...(providerEvent ? { providerEvent } : {}) };
    },
    async settleAndActivatePaidInvoice({ paymentId, invoiceId, operationId }) {
      return database.$transaction(async (tx: any) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionInvoice" WHERE "id" = ${invoiceId} FOR UPDATE`);
        const lockedInvoice = await tx.subscriptionInvoice.findUnique({ where: { id: invoiceId }, select: { billingCycleId: true, contractId: true } });
        if (!lockedInvoice) return { outcome: "RECONCILIATION_REQUIRED" as const };
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionBillingCycle" WHERE "id" = ${lockedInvoice.billingCycleId} FOR UPDATE`);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionContract" WHERE "id" = ${lockedInvoice.contractId} FOR UPDATE`);
        const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { successWebhookEvent: true } });
        const invoice = await tx.subscriptionInvoice.findUnique({ where: { id: invoiceId }, include: { contract: { include: { paymentAuthority: true } }, billingCycle: true } });
        if (!payment || !invoice || payment.status !== "SUCCEEDED" || payment.subjectType !== "SUBSCRIPTION_INVOICE" || payment.subscriptionInvoiceId !== invoice.id || payment.userId !== invoice.payerUserId || payment.amount.toFixed(2) !== invoice.total.toFixed(2)) return { outcome: "RECONCILIATION_REQUIRED" as const };
        const tokenFingerprint = payment.successWebhookEvent?.safePayloadSnapshot && typeof payment.successWebhookEvent.safePayloadSnapshot === "object" && !Array.isArray(payment.successWebhookEvent.safePayloadSnapshot)
          ? (payment.successWebhookEvent.safePayloadSnapshot as Record<string, unknown>).recurringTokenFingerprint
          : null;
        const authority = invoice.contract.paymentAuthority;
        if (authority?.providerTokenFingerprint && authority.providerTokenFingerprint !== tokenFingerprint) return { outcome: "RECONCILIATION_REQUIRED" as const };
        if (authority && !authority.providerTokenFingerprint && typeof tokenFingerprint === "string") {
          await tx.subscriptionPaymentAuthority.update({ where: { id: authority.id }, data: { providerTokenFingerprint: tokenFingerprint, providerTokenRotatedAt: new Date(), status: "ACTIVE", authorisedAt: authority.authorisedAt ?? new Date(), version: { increment: 1 } } });
        }
        const existingSettlement = await tx.subscriptionInvoiceSettlement.findUnique({ where: { invoiceId: invoice.id } });
        if (invoice.status === "PAID" && invoice.billingCycle.status === "PAID" && existingSettlement) return { outcome: "DUPLICATE" as const };
        if (!["PENDING_INITIAL_PAYMENT", "ACTIVE", "GRACE"].includes(invoice.contract.status)) return { outcome: "RECONCILIATION_REQUIRED" as const };
        await tx.subscriptionRenewalApplication.upsert({ where: { paymentId: payment.id }, create: { publicReference: safeReference("subapply", payment.id), invoiceId: invoice.id, paymentId: payment.id, operationId, classification: invoice.billingCycle.cycleNumber === 1 ? "INITIAL_PAYMENT" : "RENEWAL_PAYMENT", safeEvidence: { invoiceReference: invoice.publicReference, paymentReference: payment.publicReference, cycleNumber: invoice.billingCycle.cycleNumber } }, update: {} });
        if (!existingSettlement) {
          const accounts = await tx.ledgerAccount.findMany({ where: { wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" }, code: { in: ["PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", "PLATFORM-SUBSCRIPTION-DEFERRED-REVENUE-ZAR", "PLATFORM-SUBSCRIPTION-TAX-PAYABLE-ZAR"] }, currency: "ZAR", status: "ACTIVE" }, select: { id: true, code: true, purpose: true, category: true } });
          const held = accounts.find((account: any) => account.code === "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" && account.purpose === "HELD" && account.category === "LIABILITY");
          const deferred = accounts.find((account: any) => account.code === "PLATFORM-SUBSCRIPTION-DEFERRED-REVENUE-ZAR" && account.purpose === "SUBSCRIPTION_DEFERRED_REVENUE" && account.category === "LIABILITY");
          const tax = accounts.find((account: any) => account.code === "PLATFORM-SUBSCRIPTION-TAX-PAYABLE-ZAR" && account.purpose === "SUBSCRIPTION_TAX_PAYABLE" && account.category === "LIABILITY");
          const taxAmount = invoice.taxAmount.toFixed(2); const netAmount = invoice.subtotal.toFixed(2);
          if (!held || !deferred || (taxAmount !== "0.00" && !tax)) return { outcome: "RECONCILIATION_REQUIRED" as const };
          const journal = await postLedgerJournalWithinTransaction(tx, subscriptionInvoiceSettlementPosting({ invoiceReference: invoice.publicReference, paymentReference: payment.publicReference, amount: invoice.total.toFixed(2), netAmount, taxAmount, customerFundsHeldAccountId: held.id, deferredRevenueAccountId: deferred.id, ...(tax ? { taxPayableAccountId: tax.id } : {}) }));
          await tx.subscriptionInvoiceSettlement.create({ data: { publicReference: safeReference("subsettle", invoice.id), invoiceId: invoice.id, billingCycleId: invoice.billingCycleId, paymentId: payment.id, status: "SETTLED", currency: "ZAR", settledAmount: invoice.total, taxAmount: invoice.taxAmount, netAmount: invoice.subtotal, ledgerJournalId: journal.id, operationId: `subscription-settlement:${payment.id}`, safeEvidence: { paymentReference: payment.publicReference, invoiceReference: invoice.publicReference, journalReference: journal.reference, settledFrom: "PLATFORM_CUSTOMER_FUNDS_HELD_ZAR" } } });
        }
        const now = new Date();
        await tx.subscriptionInvoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidAt: now } });
        await tx.subscriptionBillingCycle.update({ where: { id: invoice.billingCycleId }, data: { status: "PAID", amountPaid: invoice.total, paidAt: now, completedAt: now } });
        await tx.subscriptionContract.update({ where: { id: invoice.contractId }, data: { status: "ACTIVE", startedAt: invoice.contract.startedAt ?? now, currentPeriodStart: invoice.billingCycle.periodStart, currentPeriodEnd: invoice.billingCycle.periodEnd, paidThroughAt: invoice.billingCycle.periodEnd, version: { increment: 1 } } });
        const benefits = await tx.subscriptionBenefitDefinition.findMany({ where: { planVersionId: invoice.contract.planVersionId } });
        for (const benefit of benefits) {
          await tx.subscriptionEntitlementGrant.upsert({ where: { billingCycleId_benefitDefinitionId: { billingCycleId: invoice.billingCycleId, benefitDefinitionId: benefit.id } }, create: { publicReference: safeReference("subgrant", `${invoice.id}_${benefit.id}`), contractId: invoice.contractId, billingCycleId: invoice.billingCycleId, benefitDefinitionId: benefit.id, subjectType: invoice.contract.subjectType, customerUserId: invoice.contract.customerUserId, storeId: invoice.contract.storeId, status: "ACTIVE", valueType: benefit.valueType, originalAmount: benefit.amount, remainingAmount: benefit.amount, originalQuantity: benefit.quantity, remainingQuantity: benefit.quantity, effectiveFrom: invoice.billingCycle.periodStart, effectiveUntil: invoice.billingCycle.periodEnd, sourceVersion: benefit.sourceVersion }, update: {} });
        }
        await tx.subscriptionRevenueRecognitionSchedule.upsert({ where: { invoiceId: invoice.id }, create: { publicReference: safeReference("subrev", invoice.id), invoiceId: invoice.id, billingCycleId: invoice.billingCycleId, currency: "ZAR", netAmount: invoice.subtotal, recognizedAmount: "0.00", serviceStart: invoice.billingCycle.periodStart, serviceEnd: invoice.billingCycle.periodEnd, status: "ACTIVE", policyVersion: "subscription-revenue-straight-line-v1" }, update: {} });
        const nextStart = invoice.billingCycle.periodEnd; const nextEnd = new Date(Date.UTC(nextStart.getUTCFullYear(), nextStart.getUTCMonth() + 1, nextStart.getUTCDate(), nextStart.getUTCHours(), nextStart.getUTCMinutes(), nextStart.getUTCSeconds()));
        const nextCycle = await tx.subscriptionBillingCycle.upsert({ where: { contractId_cycleNumber: { contractId: invoice.contractId, cycleNumber: invoice.billingCycle.cycleNumber + 1 } }, create: { publicReference: safeReference("subcyc", `${invoice.contractId}_${invoice.billingCycle.cycleNumber + 1}`), contractId: invoice.contractId, cycleNumber: invoice.billingCycle.cycleNumber + 1, periodStart: nextStart, periodEnd: nextEnd, billingDate: nextStart, status: "SCHEDULED", currency: "ZAR", amountDue: invoice.contract.contractedPrice, amountPaid: "0.00" }, update: {} });
        await tx.subscriptionRenewalJob.upsert({ where: { billingCycleId: nextCycle.id }, create: { publicReference: safeReference("subrenew", nextCycle.id), contractId: invoice.contractId, billingCycleId: nextCycle.id, status: "PENDING", operationId: `subscription-renewal:${nextCycle.id}`, requestHash: `cycle:${nextCycle.id}`, attemptCount: 0, nextAttemptAt: nextStart }, update: {} });
        await tx.subscriptionRenewalJob.updateMany({ where: { billingCycleId: invoice.billingCycleId, status: { not: "COMPLETED" } }, data: { status: "COMPLETED", completedAt: now } });
        await tx.subscriptionContractStatusHistory.upsert({ where: { contractId_operationId: { contractId: invoice.contractId, operationId } }, create: { contractId: invoice.contractId, fromStatus: invoice.contract.status, toStatus: "ACTIVE", actorType: "PROVIDER", operationId, safeMetadata: { paymentReference: payment.publicReference, invoiceReference: invoice.publicReference } }, update: {} });
        await tx.subscriptionEventIntent.upsert({ where: { contractId_type_operationId: { contractId: invoice.contractId, type: "SUBSCRIPTION_ACTIVATED", operationId } }, create: { publicReference: safeReference("subevt", operationId), contractId: invoice.contractId, type: "SUBSCRIPTION_ACTIVATED", operationId, safePayload: { invoiceReference: invoice.publicReference } }, update: {} });
        return { outcome: "ACTIVATED" as const };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
    async openApplicationReconciliation({ paymentId, invoiceId, reason }) {
      await database.subscriptionReconciliationCase.upsert({ where: { caseKey: `subscription-payment:${paymentId}:${reason}` }, create: { publicReference: safeReference("subrec", `${paymentId}_${reason}`), caseKey: `subscription-payment:${paymentId}:${reason}`, paymentId, invoiceId, reason, priority: "CRITICAL", safeSummary: "Verified subscription payment could not be coherently applied." }, update: { lastObservedAt: new Date() } });
    },
  });
}

export async function onVerifiedSubscriptionPaymentSucceededInProduction(paymentId: string): Promise<void> {
  await onVerifiedSubscriptionPaymentSucceeded(createPrismaSubscriptionPaymentSuccessHookRepository(), paymentId);
}
