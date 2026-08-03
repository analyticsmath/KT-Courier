import { SubscriptionError } from "@/lib/subscriptions/errors";
import { assertSubscriptionsProductionReady } from "@/lib/subscriptions/production-lock";
import type { RecurringPaymentProvider } from "@/lib/subscriptions/providers/recurring-payment-provider";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { onVerifiedSubscriptionPaymentSucceeded } from "@/lib/subscriptions/subscription-payment-success-hook.service";
import { createPrismaSubscriptionPaymentSuccessHookRepository } from "@/lib/subscriptions/subscription-payment-success-hook.service";

export type SubscriptionRenewalLifecycleRepository = Readonly<{
  createNextCycle(input: Readonly<{ contractReference: string; operationId: string; at: Date }>): Promise<Readonly<{ outcome: "CREATED" | "REPLAY" | "CANCELLED" | "RECONCILIATION_REQUIRED"; billingCycleReference?: string; invoiceReference?: string }>>;
  prepareRenewal(input: Readonly<{ billingCycleReference: string; operationId: string }>): Promise<Readonly<{ outcome: "PREPARED" | "REPLAY" | "CANCELLED" | "RECONCILIATION_REQUIRED"; authorityReference?: string; invoiceReference?: string; paymentReference?: string; amount?: string }>>;
  applyVerifiedRenewal(input: Readonly<{ paymentId: string; invoiceReference: string; operationId: string }>): Promise<Readonly<{ outcome: "APPLIED" | "REPLAY" | "RECONCILIATION_REQUIRED" }>>;
}>;

/** Creates a unique next cycle/invoice before the provider billing date; it never fabricates a late invoice. */
export async function createNextSubscriptionBillingCycle(repository: SubscriptionRenewalLifecycleRepository, input: Readonly<{ contractReference: string; operationId: string; at?: Date }>) {
  return repository.createNextCycle({ ...input, at: input.at ?? new Date() });
}

/** Provider-managed mode sends no platform token charge. It durably prepares the exact next invoice for ITN. */
export async function prepareSubscriptionRenewalPayment(repository: SubscriptionRenewalLifecycleRepository, input: Readonly<{ billingCycleReference: string; operationId: string }>) {
  return repository.prepareRenewal(input);
}

/** Called only after Phase 12 has verified a provider-managed recurring ITN against the prepared invoice. */
export async function applyVerifiedSubscriptionRenewal(repository: SubscriptionRenewalLifecycleRepository, input: Readonly<{ paymentId: string; invoiceReference: string; operationId: string }>) {
  return repository.applyVerifiedRenewal(input);
}

/**
 * A platform charge is deliberately impossible until the complete token model
 * has provider validation. This protects an UNKNOWN provider outcome from
 * causing a blind second debit.
 */
export async function requestPlatformScheduledTokenRenewal(provider: RecurringPaymentProvider, input: Readonly<{ authorityReference: string; invoiceReference: string; paymentReference: string; amount: string; operationId: string; testApproval?: { approved: true } }>) {
  assertSubscriptionsProductionReady("RECURRING_CHARGE", input.testApproval);
  void provider;
  throw new SubscriptionError("CONSOLIDATED_VALIDATION_NOT_APPROVED", "PLATFORM_SCHEDULED_TOKEN is source-locked pending complete provider token validation.");
}

/* eslint-disable @typescript-eslint/no-explicit-any -- generated Phase 22 client validation is deferred. */
const db = prisma as any;
const ref = (prefix: string) => `${prefix}_${randomBytes(12).toString("base64url")}`;
const monthLater = (start: Date) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds()));

/** Concrete repository for the provider-managed renewal path. It prepares the exact invoice and Phase 12 attempt before any ITN can apply it. */
export function createPrismaSubscriptionRenewalLifecycleRepository(database: any = db): SubscriptionRenewalLifecycleRepository {
  return Object.freeze({
    async createNextCycle(input) {
      return database.$transaction(async (tx: any) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionContract" WHERE "publicReference" = ${input.contractReference} FOR UPDATE`);
        const contract = await tx.subscriptionContract.findUnique({ where: { publicReference: input.contractReference }, include: { billingCycles: { include: { invoice: true }, orderBy: { cycleNumber: "desc" }, take: 1 } } });
        if (!contract || !["ACTIVE", "GRACE", "PAST_DUE"].includes(contract.status)) return { outcome: contract?.status === "CANCELLATION_SCHEDULED" ? "CANCELLED" as const : "RECONCILIATION_REQUIRED" as const };
        const prior = contract.billingCycles[0];
        if (!prior?.invoice) return { outcome: "RECONCILIATION_REQUIRED" as const };
        if (contract.cancellationEffectiveAt && prior.periodEnd >= contract.cancellationEffectiveAt) return { outcome: "CANCELLED" as const };
        const existing = await tx.subscriptionBillingCycle.findUnique({ where: { contractId_cycleNumber: { contractId: contract.id, cycleNumber: prior.cycleNumber + 1 } }, include: { invoice: true } });
        if (existing?.invoice) return { outcome: "REPLAY" as const, billingCycleReference: existing.publicReference, invoiceReference: existing.invoice.publicReference };
        const periodStart = prior.periodEnd; const periodEnd = monthLater(periodStart);
        const cycle = await tx.subscriptionBillingCycle.create({ data: { publicReference: ref("subcyc"), contractId: contract.id, cycleNumber: prior.cycleNumber + 1, periodStart, periodEnd, billingDate: periodStart, status: "SCHEDULED", currency: "ZAR", amountDue: contract.contractedPrice, amountPaid: "0.00" } });
        const invoice = await tx.subscriptionInvoice.create({ data: { publicReference: ref("subinv"), invoiceNumber: ref("INV"), contractId: contract.id, billingCycleId: cycle.id, payerUserId: contract.payerUserId, status: "ISSUED", currency: "ZAR", subtotal: prior.invoice.subtotal, taxAmount: prior.invoice.taxAmount, total: prior.invoice.total, planSnapshot: prior.invoice.planSnapshot, benefitSnapshot: prior.invoice.benefitSnapshot, supplierSnapshot: prior.invoice.supplierSnapshot, legalDocumentVersion: prior.invoice.legalDocumentVersion, dueAt: periodStart } });
        return { outcome: "CREATED" as const, billingCycleReference: cycle.publicReference, invoiceReference: invoice.publicReference };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
    async prepareRenewal(input) {
      return database.$transaction(async (tx: any) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionBillingCycle" WHERE "publicReference" = ${input.billingCycleReference} FOR UPDATE`);
        const cycle = await tx.subscriptionBillingCycle.findUnique({ where: { publicReference: input.billingCycleReference }, include: { invoice: true, contract: { include: { paymentAuthority: true } } } });
        if (!cycle?.invoice || !cycle.contract.paymentAuthority || cycle.contract.status === "CANCELLATION_SCHEDULED" || cycle.contract.status === "CANCELLED") return { outcome: "CANCELLED" as const };
        const priorPayment = await tx.payment.findUnique({ where: { subscriptionInvoiceId: cycle.invoice.id } });
        if (priorPayment) return { outcome: "REPLAY" as const, authorityReference: cycle.contract.paymentAuthority.publicReference, invoiceReference: cycle.invoice.publicReference, paymentReference: priorPayment.publicReference, amount: priorPayment.amount.toFixed(2) };
        const payment = await tx.payment.create({ data: { publicReference: ref("pay"), userId: cycle.contract.payerUserId, orderId: null, marketplaceCheckoutId: null, marketplaceOrderId: null, subscriptionInvoiceId: cycle.invoice.id, subjectType: "SUBSCRIPTION_INVOICE", provider: "PAYFAST", purpose: "ORDER", status: "PROVIDER_PENDING", amount: cycle.invoice.total, currency: "ZAR", creationIdempotencyKey: `subscription-renewal:${cycle.id}`, creationRequestHash: `subscription-renewal-invoice:${cycle.invoice.id}`, latestAttemptNumber: 1, version: 1, metadata: { subjectType: "SUBSCRIPTION_INVOICE", invoiceReference: cycle.invoice.publicReference, renewal: true } } });
        const environment = process.env.PAYFAST_MODE?.trim().toLowerCase() === "production" ? "PRODUCTION" : "SANDBOX";
        await tx.paymentAttempt.create({ data: { paymentId: payment.id, publicReference: ref("pat"), attemptNumber: 1, provider: "PAYFAST", idempotencyKey: `subscription-renewal-attempt:${cycle.invoice.id}`, requestHash: `subscription-renewal-attempt:${cycle.invoice.id}`, merchantReference: cycle.invoice.publicReference, status: "REQUESTING", amount: cycle.invoice.total, currency: "ZAR", providerEnvironment: environment, providerProtocolVersion: "payfast-recurring-v1", configurationFingerprint: environment === "PRODUCTION" ? "payfast-v1:production" : "payfast-v1:sandbox", providerCredentialVersion: process.env.PAYFAST_CREDENTIAL_VERSION?.trim() || "subscription-config-unresolved", startedAt: new Date(), version: 0 } });
        await tx.subscriptionBillingCycle.update({ where: { id: cycle.id }, data: { status: "PAYMENT_PENDING" } });
        await tx.subscriptionRenewalJob.upsert({ where: { billingCycleId: cycle.id }, create: { publicReference: ref("subrenew"), contractId: cycle.contractId, billingCycleId: cycle.id, status: "PAYMENT_PENDING", operationId: `subscription-renewal:${cycle.id}`, requestHash: `cycle:${cycle.id}`, attemptCount: 0, nextAttemptAt: new Date() }, update: { status: "PAYMENT_PENDING" } });
        return { outcome: "PREPARED" as const, authorityReference: cycle.contract.paymentAuthority.publicReference, invoiceReference: cycle.invoice.publicReference, paymentReference: payment.publicReference, amount: payment.amount.toFixed(2) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
    async applyVerifiedRenewal(input) {
      const payment = await database.payment.findUnique({ where: { id: input.paymentId }, include: { subscriptionInvoice: true } });
      if (!payment?.subscriptionInvoice || payment.subscriptionInvoice.publicReference !== input.invoiceReference || payment.status !== "SUCCEEDED") return { outcome: "RECONCILIATION_REQUIRED" as const };
      await onVerifiedSubscriptionPaymentSucceeded(createPrismaSubscriptionPaymentSuccessHookRepository(database), payment.id);
      return { outcome: payment.subscriptionInvoice.status === "PAID" ? "REPLAY" as const : "APPLIED" as const };
    },
  });
}
