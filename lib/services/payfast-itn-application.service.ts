import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PaymentError } from "@/lib/payments/errors";
import type { PaymentAttemptState, PaymentReconciliationReasonCode, PaymentState } from "@/lib/payments/types";
import { withPaymentDatabaseRetry } from "@/lib/payments/retry";
import { decidePayfastItnApplication } from "@/lib/payments/providers/payfast/payfast-itn-status-policy";
import { buildPayfastReceiptPosting } from "@/lib/payments/providers/payfast/payfast-ledger-posting-policy";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import {
  openPaymentReconciliationCaseWithinTransaction,
  resolvePaymentReconciliationCasesWithinTransaction,
} from "@/lib/services/payment-reconciliation.service";
import type {
  PayfastItnVerificationFailure,
  PayfastReceiptDraft,
  VerifiedPayfastItn,
} from "@/lib/services/payfast-itn-verification.service";

export type PayfastItnApplicationResult = Readonly<{
  outcome: "APPLIED" | "DUPLICATE" | "IGNORED_STALE" | "RECONCILIATION_REQUIRED";
  eventPublicReference: string;
  ledgerJournalReference: string | null;
}>;

function eventReference(): string {
  return `pwe_${randomBytes(18).toString("base64url")}`;
}

export const VERIFIED_PAYMENT_EVENT_TYPE = "PAYMENT_SUCCEEDED_VERIFIED" as const;
export const VERIFIED_PAYMENT_EVENT_SCHEMA_VERSION = 1 as const;

type Phase4TransactionExtensions = Readonly<{
  marketplaceCheckout: Readonly<{ findUnique(input: unknown): Promise<Readonly<{ publicReference: string }> | null> }>;
  subscriptionInvoice: Readonly<{ findUnique(input: unknown): Promise<Readonly<{ publicReference: string }> | null> }>;
  paymentVerifiedEventIntent: Readonly<{
    findUnique(input: unknown): Promise<Readonly<{ publicReference: string; paymentId: string; successfulAttemptId: string; webhookEventId: string; amount: Readonly<{ toFixed(scale: number): string }>; currency: string }> | null>;
    create(input: unknown): Promise<Readonly<{ publicReference: string }>>;
  }>;
  notificationEventIntent: Readonly<{ upsert(input: unknown): Promise<unknown> }>;
}>;

function phase4Tx(tx: Prisma.TransactionClient): Prisma.TransactionClient & Phase4TransactionExtensions {
  return tx as Prisma.TransactionClient & Phase4TransactionExtensions;
}

function verifiedPaymentEventIdentity(paymentReference: string, webhookEventReference: string): string {
  return `payment-verified:${paymentReference}:${webhookEventReference}:v${VERIFIED_PAYMENT_EVENT_SCHEMA_VERSION}`;
}

function verifiedPaymentEventReference(identity: string): string {
  return `pve_${createHash("sha256").update(identity).digest("base64url").slice(0, 40)}`;
}

async function resolveVerifiedPaymentSubjectReference(
  tx: Prisma.TransactionClient,
  payment: { subjectType: string; orderId: string | null; marketplaceCheckoutId: string | null; subscriptionInvoiceId: string | null },
): Promise<string> {
  if (payment.subjectType === "COURIER_ORDER") {
    const order = payment.orderId ? await tx.order.findUnique({ where: { id: payment.orderId }, select: { orderNumber: true } }) : null;
    if (!order) throw new PaymentError("PAYFAST_EVENT_CONFLICT", "Successful courier payment is missing its canonical order reference.");
    return order.orderNumber;
  }
  if (payment.subjectType === "MARKETPLACE_CHECKOUT") {
    const checkout = payment.marketplaceCheckoutId ? await phase4Tx(tx).marketplaceCheckout.findUnique({ where: { id: payment.marketplaceCheckoutId }, select: { publicReference: true } }) : null;
    if (!checkout?.publicReference) throw new PaymentError("PAYFAST_EVENT_CONFLICT", "Successful marketplace payment is missing its canonical checkout reference.");
    return checkout.publicReference;
  }
  if (payment.subjectType === "SUBSCRIPTION_INVOICE") {
    const invoice = payment.subscriptionInvoiceId ? await phase4Tx(tx).subscriptionInvoice.findUnique({ where: { id: payment.subscriptionInvoiceId }, select: { publicReference: true } }) : null;
    if (!invoice?.publicReference) throw new PaymentError("PAYFAST_EVENT_CONFLICT", "Successful subscription payment is missing its canonical invoice reference.");
    return invoice.publicReference;
  }
  throw new PaymentError("PAYFAST_EVENT_CONFLICT", "Successful payment has an unsupported subject.");
}

async function appendVerifiedPaymentEventWithinTransaction(
  tx: Prisma.TransactionClient,
  input: Readonly<{
    payment: { id: string; publicReference: string; subjectType: string; orderId: string | null; marketplaceCheckoutId: string | null; subscriptionInvoiceId: string | null; userId: string | null; amount: Prisma.Decimal; currency: string; successfulAttemptId: string | null; successWebhookEventId: string | null };
    attemptId: string;
    webhookEventId: string;
    webhookEventReference: string;
    verifiedAt: Date;
  }>,
): Promise<{ publicReference: string }> {
  if (!input.payment.successfulAttemptId || !input.payment.successWebhookEventId || input.payment.successfulAttemptId !== input.attemptId || input.payment.successWebhookEventId !== input.webhookEventId || input.payment.currency !== "ZAR" || input.payment.amount.lessThanOrEqualTo(0)) {
    throw new PaymentError("PAYFAST_EVENT_CONFLICT", "Verified payment event evidence is not coherent.");
  }
  const subjectReference = await resolveVerifiedPaymentSubjectReference(tx, input.payment);
  const eventIdentity = verifiedPaymentEventIdentity(input.payment.publicReference, input.webhookEventReference);
  const eventStore = phase4Tx(tx).paymentVerifiedEventIntent;
  const existing = await eventStore.findUnique({ where: { eventIdentity } });
  if (existing) {
    if (existing.paymentId !== input.payment.id || existing.successfulAttemptId !== input.attemptId || existing.webhookEventId !== input.webhookEventId || existing.amount.toFixed(2) !== input.payment.amount.toFixed(2) || existing.currency !== input.payment.currency) {
      throw new PaymentError("PAYFAST_EVENT_CONFLICT", "Verified payment event identity conflicts with canonical evidence.");
    }
    return { publicReference: existing.publicReference };
  }
  const created = await eventStore.create({
    data: {
      publicReference: verifiedPaymentEventReference(eventIdentity),
      eventIdentity,
      eventType: VERIFIED_PAYMENT_EVENT_TYPE,
      paymentId: input.payment.id,
      successfulAttemptId: input.attemptId,
      webhookEventId: input.webhookEventId,
      paymentReference: input.payment.publicReference,
      subjectType: input.payment.subjectType,
      subjectReference,
      payerUserId: input.payment.userId,
      amount: input.payment.amount,
      currency: "ZAR",
      provider: "PAYFAST",
      verifiedAt: input.verifiedAt,
      schemaVersion: VERIFIED_PAYMENT_EVENT_SCHEMA_VERSION,
    },
  });
  await phase4Tx(tx).notificationEventIntent.upsert({
    where: { operationId: `payment-verified-notification:${eventIdentity}` },
    update: {},
    create: {
      sourceAuthority: "PAYMENT",
      eventType: VERIFIED_PAYMENT_EVENT_TYPE,
      aggregateReference: input.payment.publicReference,
      operationId: `payment-verified-notification:${eventIdentity}`,
      safePayload: {
        paymentReference: input.payment.publicReference,
        subjectType: input.payment.subjectType,
        subjectReference,
        amount: input.payment.amount.toFixed(2),
        currency: "ZAR",
        provider: "PAYFAST",
        verifiedPaymentEventReference: created.publicReference,
        schemaVersion: VERIFIED_PAYMENT_EVENT_SCHEMA_VERSION,
      },
    },
  });
  return { publicReference: created.publicReference };
}

function eventCreateData(
  receipt: PayfastReceiptDraft,
  processingStatus: "REJECTED" | "VERIFIED" | "RECONCILIATION_REQUIRED" | "TEMPORARY_FAILURE",
  options: { verifiedAt?: Date; rejectionCode?: string; reconciliationReason?: PaymentReconciliationReasonCode | null } = {},
) {
  return {
    publicReference: eventReference(),
    provider: "PAYFAST" as const,
    environment: receipt.environment,
    eventFingerprint: receipt.fingerprint,
    merchantReference: receipt.merchantReference,
    providerPaymentId: receipt.providerPaymentId,
    providerStatus: receipt.providerStatus,
    normalizedStatus: receipt.normalizedStatus,
    processingStatus,
    paymentId: receipt.paymentId,
    attemptId: receipt.attemptId,
    credentialVersion: receipt.credentialVersion,
    sourceAddress: receipt.sourceAddress,
    sourceAddressVerified: receipt.sourceAddressVerified,
    signatureVerified: receipt.signatureVerified,
    merchantVerified: receipt.merchantVerified,
    amountVerified: receipt.amountVerified,
    providerDataVerified: receipt.providerDataVerified,
    safePayloadSnapshot: receipt.safePayloadSnapshot as Prisma.InputJsonValue,
    unknownFieldCount: receipt.unknownFieldCount,
    rejectionCode: options.rejectionCode,
    reconciliationReason: options.reconciliationReason,
    verifiedAt: options.verifiedAt,
  };
}

async function ensureVerifiedReceipt(verified: VerifiedPayfastItn) {
  const existing = await prisma.paymentWebhookEvent.findUnique({ where: { eventFingerprint: verified.receipt.fingerprint } });
  if (existing) {
    if (["VERIFIED", "APPLIED", "DUPLICATE", "IGNORED_STALE", "RECONCILIATION_REQUIRED"].includes(existing.processingStatus)) return existing;
    return prisma.paymentWebhookEvent.update({
      where: { id: existing.id },
      data: {
        processingStatus: "VERIFIED",
        paymentId: existing.paymentId ?? verified.attempt.paymentId,
        attemptId: existing.attemptId ?? verified.attempt.id,
        credentialVersion: existing.credentialVersion ?? verified.attempt.providerCredentialVersion,
        sourceAddressVerified: true,
        signatureVerified: true,
        merchantVerified: true,
        amountVerified: true,
        providerDataVerified: true,
        rejectionCode: null,
        reconciliationReason: null,
        verifiedAt: existing.verifiedAt ?? verified.verifiedAt,
      },
    });
  }
  try {
    return await prisma.paymentWebhookEvent.create({
      data: eventCreateData(verified.receipt, "VERIFIED", { verifiedAt: verified.verifiedAt }),
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const winner = await prisma.paymentWebhookEvent.findUnique({ where: { eventFingerprint: verified.receipt.fingerprint } });
    if (!winner) throw error;
    return winner;
  }
}

export async function recordPayfastVerificationFailure(failure: PayfastItnVerificationFailure) {
  if (!failure.receipt) return null;
  const receipt = failure.receipt;
  const processingStatus = failure.retryable
    ? "TEMPORARY_FAILURE" as const
    : failure.reconciliationReason
      ? "RECONCILIATION_REQUIRED" as const
      : "REJECTED" as const;
  return prisma.$transaction(async (tx) => {
    let event = await tx.paymentWebhookEvent.findUnique({ where: { eventFingerprint: receipt.fingerprint } });
    if (!event) {
      event = await tx.paymentWebhookEvent.create({
        data: eventCreateData(receipt, processingStatus, {
          rejectionCode: failure.code,
          reconciliationReason: failure.reconciliationReason,
        }),
      });
    } else if (!["REJECTED", "APPLIED", "DUPLICATE", "IGNORED_STALE", "RECONCILIATION_REQUIRED"].includes(event.processingStatus)) {
      event = await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: {
          processingStatus,
          rejectionCode: failure.code,
          reconciliationReason: failure.reconciliationReason,
          sourceAddressVerified: receipt.sourceAddressVerified,
          signatureVerified: receipt.signatureVerified,
          merchantVerified: receipt.merchantVerified,
          amountVerified: receipt.amountVerified,
          providerDataVerified: false,
        },
      });
    }
    if (failure.reconciliationReason && receipt.paymentId) {
      await openPaymentReconciliationCaseWithinTransaction(tx, {
        paymentId: receipt.paymentId,
        attemptId: receipt.attemptId,
        webhookEventId: event.id,
        reason: failure.reconciliationReason,
        safeEvidence: { eventReference: event.publicReference, failureCode: failure.code },
      });
      await tx.payment.update({ where: { id: receipt.paymentId }, data: { reconciliationStatus: "REQUIRED" } });
    }
    return event;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function reconcileWithinApplication(
  tx: Prisma.TransactionClient,
  event: { id: string; publicReference: string },
  payment: { id: string },
  attempt: { id: string },
  reason: PaymentReconciliationReasonCode,
  safeEvidence: Readonly<Record<string, string | null>>,
): Promise<PayfastItnApplicationResult> {
  await openPaymentReconciliationCaseWithinTransaction(tx, {
    paymentId: payment.id,
    attemptId: attempt.id,
    webhookEventId: event.id,
    reason,
    safeEvidence,
  });
  await tx.payment.update({ where: { id: payment.id }, data: { reconciliationStatus: "REQUIRED" } });
  await tx.paymentWebhookEvent.update({
    where: { id: event.id },
    data: { processingStatus: "RECONCILIATION_REQUIRED", reconciliationReason: reason },
  });
  return Object.freeze({ outcome: "RECONCILIATION_REQUIRED", eventPublicReference: event.publicReference, ledgerJournalReference: null });
}

type PayfastApplicationDependencies = Readonly<{
  afterLedgerPosted?: (journalId: string) => Promise<void> | void;
}>;

async function applyVerifiedEventTransaction(eventId: string, verified: VerifiedPayfastItn, dependencies: PayfastApplicationDependencies): Promise<PayfastItnApplicationResult> {
  return prisma.$transaction(async (tx) => {
    // Global Phase 12 lock order: event -> payment -> attempt -> sorted ledger accounts.
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentWebhookEvent" WHERE "id" = ${eventId} FOR UPDATE`);
    const event = await tx.paymentWebhookEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new PaymentError("PAYFAST_APPLICATION_UNAVAILABLE", "Payfast event receipt was not found.", true);
    if (event.processingStatus === "APPLIED" || event.processingStatus === "DUPLICATE") {
      const journal = event.ledgerJournalId ? await tx.ledgerJournal.findUnique({ where: { id: event.ledgerJournalId }, select: { reference: true } }) : null;
      return Object.freeze({ outcome: "DUPLICATE", eventPublicReference: event.publicReference, ledgerJournalReference: journal?.reference ?? null });
    }
    if (event.processingStatus === "IGNORED_STALE") {
      return Object.freeze({ outcome: "IGNORED_STALE", eventPublicReference: event.publicReference, ledgerJournalReference: null });
    }
    if (event.processingStatus === "RECONCILIATION_REQUIRED") {
      return Object.freeze({ outcome: "RECONCILIATION_REQUIRED", eventPublicReference: event.publicReference, ledgerJournalReference: null });
    }

    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${verified.attempt.paymentId} FOR UPDATE`);
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${verified.attempt.id} FOR UPDATE`);
    const [payment, attempt] = await Promise.all([
      tx.payment.findUnique({ where: { id: verified.attempt.paymentId } }),
      tx.paymentAttempt.findUnique({ where: { id: verified.attempt.id } }),
    ]);
    if (!payment || !attempt) throw new PaymentError("PAYFAST_APPLICATION_UNAVAILABLE", "Payfast payment evidence could not be reloaded.", true);
    if (
      (event.paymentId !== null && event.paymentId !== payment.id)
      || (event.attemptId !== null && event.attemptId !== attempt.id)
      || attempt.paymentId !== payment.id
      || attempt.merchantReference !== event.merchantReference
      || attempt.provider !== "PAYFAST"
      || attempt.providerCredentialVersion !== event.credentialVersion
      || !event.sourceAddressVerified
      || !event.signatureVerified
      || !event.merchantVerified
      || !event.amountVerified
      || !event.providerDataVerified
      || !event.verifiedAt
      || payment.currency !== "ZAR"
      || attempt.currency !== "ZAR"
      || !payment.amount.equals(attempt.amount)
      || !payment.amount.equals(new Prisma.Decimal(verified.fields.amountGross))
    ) throw new PaymentError("PAYFAST_EVENT_CONFLICT", "Payfast event evidence changed before application.");

    const conflictingAttempt = await tx.paymentAttempt.findFirst({
      where: { provider: "PAYFAST", providerReference: verified.fields.providerPaymentId, NOT: { id: attempt.id } },
      select: { id: true },
    });
    if (conflictingAttempt || (attempt.providerReference && attempt.providerReference !== verified.fields.providerPaymentId)) {
      return reconcileWithinApplication(tx, event, payment, attempt, "PROVIDER_REFERENCE_CONFLICT", {
        eventReference: event.publicReference,
        attemptReference: attempt.publicReference,
      });
    }

    const decision = decidePayfastItnApplication({
      normalizedStatus: event.normalizedStatus,
      paymentStatus: payment.status as PaymentState,
      attemptStatus: attempt.status as PaymentAttemptState,
      successAlreadyLinked: Boolean(payment.successWebhookEventId && payment.successLedgerJournalId),
    });
    if (
      event.normalizedStatus === "PENDING"
      && (["FAILED", "CANCELLED", "EXPIRED"] as string[]).includes(attempt.status)
    ) {
      return reconcileWithinApplication(tx, event, payment, attempt, "OUT_OF_ORDER_EVENT", { eventReference: event.publicReference, attemptReference: attempt.publicReference });
    }
    if (event.normalizedStatus === "FAILED" && attempt.status === "SUCCEEDED") {
      return reconcileWithinApplication(tx, event, payment, attempt, "CONFLICTING_PROVIDER_STATUS", { eventReference: event.publicReference, attemptReference: attempt.publicReference });
    }
    if (event.normalizedStatus === "FAILED" && (["CANCELLED", "EXPIRED"] as string[]).includes(attempt.status)) {
      return reconcileWithinApplication(tx, event, payment, attempt, "OUT_OF_ORDER_EVENT", { eventReference: event.publicReference, attemptReference: attempt.publicReference });
    }
    if (decision.action === "DUPLICATE") {
      if (payment.successfulAttemptId !== attempt.id || attempt.providerReference !== verified.fields.providerPaymentId) {
        return reconcileWithinApplication(tx, event, payment, attempt, "PROVIDER_REFERENCE_CONFLICT", { eventReference: event.publicReference, attemptReference: attempt.publicReference });
      }
      if (payment.successWebhookEventId && event.id !== payment.successWebhookEventId) {
        return reconcileWithinApplication(tx, event, payment, attempt, "CONFLICTING_PROVIDER_STATUS", { eventReference: event.publicReference, attemptReference: attempt.publicReference });
      }
      const journal = payment.successLedgerJournalId ? await tx.ledgerJournal.findUnique({ where: { id: payment.successLedgerJournalId }, select: { reference: true } }) : null;
      await tx.paymentWebhookEvent.update({ where: { id: event.id }, data: { processingStatus: "DUPLICATE", appliedAt: new Date() } });
      return Object.freeze({ outcome: "DUPLICATE", eventPublicReference: event.publicReference, ledgerJournalReference: journal?.reference ?? null });
    }
    if (decision.action === "IGNORE_STALE") {
      await tx.paymentWebhookEvent.update({ where: { id: event.id }, data: { processingStatus: "IGNORED_STALE", appliedAt: new Date() } });
      return Object.freeze({ outcome: "IGNORED_STALE", eventPublicReference: event.publicReference, ledgerJournalReference: null });
    }
    if (decision.action === "RECONCILE") {
      if (
        event.normalizedStatus === "UNKNOWN"
        && (["REQUESTING", "REQUIRES_ACTION", "PROCESSING", "UNKNOWN"] as string[]).includes(attempt.status)
        && payment.status !== "SUCCEEDED"
      ) {
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            providerReference: verified.fields.providerPaymentId,
            providerStatusCode: verified.fields.providerStatus,
            status: decision.attemptStatus,
            providerConfirmedAt: attempt.providerConfirmedAt ?? verified.verifiedAt,
            version: { increment: 1 },
          },
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "PROCESSING", reconciliationStatus: "REQUIRED", version: { increment: 1 } },
        });
        await tx.paymentStatusHistory.create({
          data: {
            paymentId: payment.id,
            attemptId: attempt.id,
            fromStatus: payment.status,
            toStatus: "PROCESSING",
            reasonCode: "PAYFAST_VERIFIED_UNKNOWN_STATUS",
            actorType: "PROVIDER",
            metadata: { webhookEventReference: event.publicReference, providerPaymentId: verified.fields.providerPaymentId },
          },
        });
      }
      return reconcileWithinApplication(tx, event, payment, attempt, decision.reconciliationReason ?? "UNKNOWN_OUTCOME", { eventReference: event.publicReference, attemptReference: attempt.publicReference });
    }

    const now = verified.verifiedAt;
    if (decision.action === "SUCCEED") {
      const accounts = await tx.ledgerAccount.findMany({
        where: {
          wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
          code: { in: ["PLATFORM-CASH-CLEARING-ZAR", "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR"] },
          currency: "ZAR",
          status: "ACTIVE",
        },
        select: { id: true, code: true, purpose: true, category: true },
      });
      const cash = accounts.find((account) => account.code === "PLATFORM-CASH-CLEARING-ZAR" && account.purpose === "CASH_CLEARING" && account.category === "ASSET");
      const held = accounts.find((account) => account.code === "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" && account.purpose === "HELD" && account.category === "LIABILITY");
      if (!cash || !held) throw new PaymentError("PAYFAST_APPLICATION_UNAVAILABLE", "Required payment receipt ledger accounts are unavailable.", true);

      const journal = await postLedgerJournalWithinTransaction(tx, buildPayfastReceiptPosting({
        paymentPublicReference: payment.publicReference,
        attemptPublicReference: attempt.publicReference ?? `attempt-${attempt.attemptNumber}`,
        eventPublicReference: event.publicReference,
        providerPaymentId: verified.fields.providerPaymentId,
        amount: payment.amount.toFixed(2),
        cashClearingAccountId: cash.id,
        customerFundsHeldAccountId: held.id,
      }));
      await dependencies.afterLedgerPosted?.(journal.id);
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          providerReference: verified.fields.providerPaymentId,
          providerStatusCode: verified.fields.providerStatus,
          status: "SUCCEEDED",
          providerConfirmedAt: attempt.providerConfirmedAt ?? now,
          completedAt: now,
          failureCategory: null,
          failureCode: null,
          failureMessage: null,
          version: { increment: 1 },
        },
      });
      await tx.paymentWebhookEvent.update({ where: { id: event.id }, data: { ledgerJournalId: journal.id } });
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCEEDED",
          successfulAttemptId: attempt.id,
          successWebhookEventId: event.id,
          successLedgerJournalId: journal.id,
          providerConfirmedAt: now,
          succeededAt: now,
          failedAt: null,
          cancelledAt: null,
          reconciliationStatus: "RESOLVED",
          version: { increment: 1 },
        },
      });
      await tx.paymentStatusHistory.create({
        data: {
          paymentId: payment.id,
          attemptId: attempt.id,
          fromStatus: payment.status,
          toStatus: "SUCCEEDED",
          reasonCode: "PAYFAST_VERIFIED_COMPLETE",
          actorType: "PROVIDER",
          metadata: { webhookEventReference: event.publicReference, providerPaymentId: verified.fields.providerPaymentId, ledgerJournalReference: journal.reference },
        },
      });
      await resolvePaymentReconciliationCasesWithinTransaction(tx, payment.id, attempt.id, "VERIFIED_COMPLETE");
      await tx.paymentWebhookEvent.update({ where: { id: event.id }, data: { processingStatus: "APPLIED", appliedAt: now } });
      await appendVerifiedPaymentEventWithinTransaction(tx, {
        payment: {
          id: payment.id,
          publicReference: payment.publicReference,
          subjectType: payment.subjectType,
          orderId: payment.orderId,
          marketplaceCheckoutId: payment.marketplaceCheckoutId,
          subscriptionInvoiceId: payment.subscriptionInvoiceId,
          userId: payment.userId,
          amount: payment.amount,
          currency: payment.currency,
          successfulAttemptId: attempt.id,
          successWebhookEventId: event.id,
        },
        attemptId: attempt.id,
        webhookEventId: event.id,
        webhookEventReference: event.publicReference,
        verifiedAt: now,
      });
      return Object.freeze({ outcome: "APPLIED", eventPublicReference: event.publicReference, ledgerJournalReference: journal.reference });
    }

    const attemptStatus = decision.attemptStatus;
    const paymentStatus = decision.paymentStatus;
    const alreadySame = attempt.status === attemptStatus && payment.status === paymentStatus && attempt.providerReference === verified.fields.providerPaymentId;
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        providerReference: verified.fields.providerPaymentId,
        providerStatusCode: verified.fields.providerStatus,
        status: attemptStatus,
        providerConfirmedAt: attempt.providerConfirmedAt ?? now,
        completedAt: attemptStatus === "FAILED" ? now : null,
        failureCategory: attemptStatus === "FAILED" ? "DECLINED" : null,
        failureCode: attemptStatus === "FAILED" ? "PAYFAST_VERIFIED_FAILED" : null,
        failureMessage: attemptStatus === "FAILED" ? "Payfast supplied verified failure evidence." : null,
        version: { increment: 1 },
      },
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: paymentStatus,
        failedAt: paymentStatus === "FAILED" ? now : null,
        reconciliationStatus: "CLEAR",
        version: { increment: 1 },
      },
    });
    await tx.paymentStatusHistory.create({
      data: {
        paymentId: payment.id,
        attemptId: attempt.id,
        fromStatus: payment.status,
        toStatus: paymentStatus,
        reasonCode: paymentStatus === "FAILED" ? "PAYFAST_VERIFIED_FAILED" : "PAYFAST_VERIFIED_PENDING",
        actorType: "PROVIDER",
        metadata: { webhookEventReference: event.publicReference, providerPaymentId: verified.fields.providerPaymentId, duplicateObservation: alreadySame },
      },
    });
    if (paymentStatus === "FAILED") await resolvePaymentReconciliationCasesWithinTransaction(tx, payment.id, attempt.id, "VERIFIED_FAILED");
    await tx.paymentWebhookEvent.update({ where: { id: event.id }, data: { processingStatus: alreadySame ? "DUPLICATE" : "APPLIED", appliedAt: now } });
    return Object.freeze({ outcome: alreadySame ? "DUPLICATE" : "APPLIED", eventPublicReference: event.publicReference, ledgerJournalReference: null });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function recordApplicationFailure(eventId: string, verified: VerifiedPayfastItn): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const event = await tx.paymentWebhookEvent.findUnique({ where: { id: eventId } });
    if (!event || ["APPLIED", "DUPLICATE", "IGNORED_STALE", "RECONCILIATION_REQUIRED"].includes(event.processingStatus)) return;
    await tx.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { processingStatus: "TEMPORARY_FAILURE", rejectionCode: "PAYFAST_APPLICATION_UNAVAILABLE", reconciliationReason: "APPLICATION_FAILURE_AFTER_VERIFICATION" },
    });
    await openPaymentReconciliationCaseWithinTransaction(tx, {
      paymentId: verified.attempt.paymentId,
      attemptId: verified.attempt.id,
      webhookEventId: event.id,
      reason: "APPLICATION_FAILURE_AFTER_VERIFICATION",
      safeEvidence: { eventReference: event.publicReference },
    });
    await tx.payment.update({ where: { id: verified.attempt.paymentId }, data: { reconciliationStatus: "REQUIRED" } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function applyVerifiedPayfastItn(
  verified: VerifiedPayfastItn,
  dependencies: PayfastApplicationDependencies = {},
): Promise<PayfastItnApplicationResult> {
  const receipt = await ensureVerifiedReceipt(verified);
  try {
    return await withPaymentDatabaseRetry(() => applyVerifiedEventTransaction(receipt.id, verified, dependencies));
  } catch (error) {
    await recordApplicationFailure(receipt.id, verified).catch(() => undefined);
    if (error instanceof PaymentError) throw error;
    throw new PaymentError("PAYFAST_APPLICATION_UNAVAILABLE", "Verified Payfast evidence could not be applied atomically.", true, { cause: error });
  }
}
