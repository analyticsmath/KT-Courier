/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PaymentError } from "@/lib/payments/errors";
import { withPaymentDatabaseRetry } from "@/lib/payments/retry";
import { verifyPaystackSignature } from "@/lib/payments/providers/paystack/paystack-signature";
import { PaystackClient, zarToSubunitCents } from "@/lib/payments/providers/paystack/paystack-client";
import { resolvePaystackConfiguration } from "@/lib/payments/providers/paystack/paystack-config";
import { buildPaystackReceiptPosting } from "@/lib/payments/providers/paystack/paystack-ledger-posting-policy";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { activateDepositCashOnDeliveryWithinTransaction } from "@/lib/services/cash-on-delivery.service";
import {
  openPaymentReconciliationCaseWithinTransaction,
  resolvePaymentReconciliationCasesWithinTransaction,
} from "@/lib/services/payment-reconciliation.service";
import type {
  PaymentProviderEnvironment,
  PaymentReconciliationReasonCode,
  PaymentWebhookNormalizedStatusCode,
} from "@/lib/payments/types";
import { consumeVerifiedPaymentEvents } from "@/lib/payments/verified-payment-event-processor.service";

export const VERIFIED_PAYMENT_EVENT_TYPE = "PAYMENT_SUCCEEDED_VERIFIED" as const;
export const VERIFIED_PAYMENT_EVENT_SCHEMA_VERSION = 1 as const;

export type PaystackWebhookPayload = Readonly<{
  event: string;
  data: {
    id: number | string;
    domain?: string;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    gateway_response?: string;
    paid_at?: string;
    created_at?: string;
    channel?: string;
    fees?: number | null;
    customer?: {
      id?: number | string;
      email?: string;
      customer_code?: string;
    };
    metadata?: Record<string, unknown>;
  };
}>;

export type PaystackWebhookApplicationResult = Readonly<{
  outcome: "APPLIED" | "DUPLICATE" | "IGNORED_NON_CHARGE" | "RECONCILIATION_REQUIRED";
  eventPublicReference: string;
  ledgerJournalReference: string | null;
}>;

function eventReference(): string {
  return `pwe_${randomBytes(18).toString("base64url")}`;
}

function verifiedPaymentEventIdentity(paymentReference: string, webhookEventReference: string): string {
  return `payment-verified:${paymentReference}:${webhookEventReference}:v${VERIFIED_PAYMENT_EVENT_SCHEMA_VERSION}`;
}

function verifiedPaymentEventReference(identity: string): string {
  return `pve_${createHash("sha256").update(identity).digest("base64url").slice(0, 40)}`;
}

async function resolveVerifiedPaymentSubjectReference(
  tx: Prisma.TransactionClient,
  payment: { subjectType: string; orderId: string | null; marketplaceCheckoutId: string | null; subscriptionInvoiceId: string | null; managedMarketingRequestId?: string | null },
): Promise<string> {
  if (payment.subjectType === "COURIER_ORDER") {
    const order = payment.orderId ? await tx.order.findUnique({ where: { id: payment.orderId }, select: { orderNumber: true } }) : null;
    if (!order) throw new PaymentError("PAYSTACK_EVENT_CONFLICT", "Successful courier payment is missing its canonical order reference.");
    return order.orderNumber;
  }
  if (payment.subjectType === "MARKETPLACE_CHECKOUT") {
    const checkout = payment.marketplaceCheckoutId ? await (tx as any).marketplaceCheckout.findUnique({ where: { id: payment.marketplaceCheckoutId }, select: { publicReference: true } }) : null;
    if (!checkout?.publicReference) throw new PaymentError("PAYSTACK_EVENT_CONFLICT", "Successful marketplace payment is missing its canonical checkout reference.");
    return checkout.publicReference;
  }
  if (payment.subjectType === "SUBSCRIPTION_INVOICE") {
    const invoice = payment.subscriptionInvoiceId ? await (tx as any).subscriptionInvoice.findUnique({ where: { id: payment.subscriptionInvoiceId }, select: { publicReference: true } }) : null;
    if (!invoice?.publicReference) throw new PaymentError("PAYSTACK_EVENT_CONFLICT", "Successful subscription payment is missing its canonical invoice reference.");
    return invoice.publicReference;
  }
  if (payment.subjectType === "MANAGED_MARKETING_REQUEST") {
    const request = payment.managedMarketingRequestId ? await (tx as any).managedMarketingRequest.findUnique({ where: { id: payment.managedMarketingRequestId }, select: { publicReference: true } }) : null;
    if (!request?.publicReference) throw new PaymentError("PAYSTACK_EVENT_CONFLICT", "Successful managed marketing payment is missing its canonical campaign reference.");
    return request.publicReference;
  }
  throw new PaymentError("PAYSTACK_EVENT_CONFLICT", "Successful payment has an unsupported subject.");
}

async function appendVerifiedPaymentEventWithinTransaction(
  tx: Prisma.TransactionClient,
  input: Readonly<{
    payment: { id: string; publicReference: string; subjectType: string; orderId: string | null; marketplaceCheckoutId: string | null; subscriptionInvoiceId: string | null; managedMarketingRequestId?: string | null; userId: string | null; amount: Prisma.Decimal; currency: string; successfulAttemptId: string | null; successWebhookEventId: string | null };
    attemptId: string;
    webhookEventId: string;
    webhookEventReference: string;
    verifiedAt: Date;
  }>,
): Promise<{ publicReference: string }> {
  if (!input.payment.successfulAttemptId || !input.payment.successWebhookEventId || input.payment.successfulAttemptId !== input.attemptId || input.payment.successWebhookEventId !== input.webhookEventId || input.payment.currency !== "ZAR" || input.payment.amount.lessThanOrEqualTo(0)) {
    throw new PaymentError("PAYSTACK_EVENT_CONFLICT", "Verified payment event evidence is not coherent.");
  }
  const subjectReference = await resolveVerifiedPaymentSubjectReference(tx, input.payment);
  const eventIdentity = verifiedPaymentEventIdentity(input.payment.publicReference, input.webhookEventReference);
  const eventStore = (tx as any).paymentVerifiedEventIntent;
  const existing = await eventStore.findUnique({ where: { eventIdentity } });
  if (existing) {
    if (existing.paymentId !== input.payment.id || existing.successfulAttemptId !== input.attemptId || existing.webhookEventId !== input.webhookEventId || existing.amount.toFixed(2) !== input.payment.amount.toFixed(2) || existing.currency !== input.payment.currency) {
      throw new PaymentError("PAYSTACK_EVENT_CONFLICT", "Verified payment event identity conflicts with canonical evidence.");
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
      provider: "PAYSTACK",
      verifiedAt: input.verifiedAt,
      schemaVersion: VERIFIED_PAYMENT_EVENT_SCHEMA_VERSION,
    },
  });
  await (tx as any).notificationEventIntent.upsert({
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
        provider: "PAYSTACK",
        verifiedPaymentEventReference: created.publicReference,
        schemaVersion: VERIFIED_PAYMENT_EVENT_SCHEMA_VERSION,
      },
    },
  });
  return { publicReference: created.publicReference };
}

export async function processPaystackWebhook(
  input: Readonly<{
    rawBody: string;
    signature: string | null;
    sourceAddress?: string;
    secretKey?: string;
    environment?: PaymentProviderEnvironment;
    clientOverride?: PaystackClient;
  }>,
): Promise<PaystackWebhookApplicationResult> {
  const secretKey = input.secretKey
    ?? process.env.PAYSTACK_SECRET_KEY?.trim()
    ?? resolvePaystackConfiguration().runtime?.secretKey;
  if (!secretKey) {
    throw new PaymentError("PAYSTACK_NOT_CONFIGURED", "Paystack secret key is not configured.");
  }

  const environment: PaymentProviderEnvironment = input.environment
    ?? (secretKey.startsWith("sk_live_") ? "PRODUCTION" : "SANDBOX");
  const credentialVersion = secretKey.startsWith("sk_live_") ? "live-v1" : "test-v1";

  // 1. Verify HMAC-SHA512 signature in constant time
  const signatureValid = verifyPaystackSignature(input.rawBody, input.signature, secretKey);
  if (!signatureValid) {
    throw new PaymentError("PAYSTACK_SIGNATURE_INVALID", "Paystack signature verification failed.");
  }

  // 2. Parse payload safely
  let payload: PaystackWebhookPayload;
  try {
    payload = JSON.parse(input.rawBody) as PaystackWebhookPayload;
  } catch {
    throw new PaymentError("PAYSTACK_CONFIGURATION_INVALID", "Paystack webhook payload could not be parsed as JSON.");
  }

  const eventFingerprint = payload.data?.id
    ? `paystack:${payload.event}:${payload.data.id}`
    : `paystack:${createHash("sha256").update(input.rawBody).digest("hex")}`;

  // 3. Handle non-charge events
  if (payload.event !== "charge.success") {
    const existing = await prisma.paymentWebhookEvent.findUnique({ where: { eventFingerprint } });
    if (existing) {
      return Object.freeze({ outcome: "IGNORED_NON_CHARGE", eventPublicReference: existing.publicReference, ledgerJournalReference: null });
    }
    const created = await prisma.paymentWebhookEvent.create({
      data: {
        publicReference: eventReference(),
        provider: "PAYSTACK",
        environment,
        eventFingerprint,
        merchantReference: payload.data?.reference ?? "unknown",
        providerPaymentId: String(payload.data?.id ?? "unknown"),
        providerStatus: payload.data?.status ?? payload.event,
        normalizedStatus: "UNKNOWN",
        processingStatus: "IGNORED_STALE",
        credentialVersion,
        sourceAddress: input.sourceAddress ?? "webhook",
        sourceAddressVerified: true,
        signatureVerified: true,
        merchantVerified: false,
        amountVerified: false,
        providerDataVerified: true,
        safePayloadSnapshot: payload as unknown as Prisma.InputJsonValue,
        unknownFieldCount: 0,
      },
    });
    return Object.freeze({ outcome: "IGNORED_NON_CHARGE", eventPublicReference: created.publicReference, ledgerJournalReference: null });
  }

  const { reference, amount: amountCents, currency, id: providerPaymentId } = payload.data;
  const providerIdStr = String(providerPaymentId);

  // 4. Look up matching PaymentAttempt by publicReference
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { publicReference: reference },
    include: { payment: true },
  });

  const now = new Date();

  // If attempt is completely unknown
  if (!attempt) {
    const event = await prisma.paymentWebhookEvent.upsert({
      where: { eventFingerprint },
      update: {},
      create: {
        publicReference: eventReference(),
        provider: "PAYSTACK",
        environment,
        eventFingerprint,
        merchantReference: reference,
        providerPaymentId: providerIdStr,
        providerStatus: payload.data.status,
        normalizedStatus: "UNKNOWN",
        processingStatus: "RECONCILIATION_REQUIRED",
        credentialVersion,
        sourceAddress: input.sourceAddress ?? "webhook",
        sourceAddressVerified: true,
        signatureVerified: true,
        merchantVerified: false,
        amountVerified: false,
        providerDataVerified: false,
        safePayloadSnapshot: payload as unknown as Prisma.InputJsonValue,
        unknownFieldCount: 0,
        reconciliationReason: "PROVIDER_REFERENCE_CONFLICT",
      },
    });
    return Object.freeze({ outcome: "RECONCILIATION_REQUIRED", eventPublicReference: event.publicReference, ledgerJournalReference: null });
  }

  const payment = attempt.payment;

  // 5. Secondary confirmation via Verify API (Mandatory Amendment #2 & #7)
  const client = input.clientOverride ?? new PaystackClient({ secretKey });
  let verifiedTx: Awaited<ReturnType<typeof client.verifyTransaction>>;
  try {
    verifiedTx = await client.verifyTransaction(reference);
  } catch (error) {
    throw new PaymentError("PAYSTACK_VERIFICATION_FAILED", "Paystack transaction verification call failed.", true, { cause: error });
  }

  const verifyData = (verifiedTx as any)?.data ?? verifiedTx;
  const isVerifiedSuccess = verifyData.status === "success" || (verifiedTx as any).status === "success";
  const isCurrencyZar = (verifyData.currency === "ZAR" || (verifiedTx as any).currency === "ZAR") && currency === "ZAR";
  const expectedCents = zarToSubunitCents(attempt.amount.toString());
  const actualVerifiedAmount = typeof verifyData.amount === "number" ? verifyData.amount : (verifiedTx as any).amount;
  const isAmountMatching = actualVerifiedAmount === amountCents && actualVerifiedAmount === expectedCents;

  // If secondary verification fails or details mismatch
  if (!isVerifiedSuccess || !isCurrencyZar || !isAmountMatching) {
    const reason: PaymentReconciliationReasonCode = !isCurrencyZar
      ? "AMOUNT_MISMATCH"
      : !isAmountMatching
        ? "AMOUNT_MISMATCH"
        : "CONFLICTING_PROVIDER_STATUS";

    return prisma.$transaction(async (tx) => {
      const event = await tx.paymentWebhookEvent.upsert({
        where: { eventFingerprint },
        update: { processingStatus: "RECONCILIATION_REQUIRED", reconciliationReason: reason },
        create: {
          publicReference: eventReference(),
          provider: "PAYSTACK",
          environment,
          eventFingerprint,
          merchantReference: reference,
          providerPaymentId: providerIdStr,
          providerStatus: payload.data.status,
          normalizedStatus: (isVerifiedSuccess ? "COMPLETE" : "FAILED") as PaymentWebhookNormalizedStatusCode,
          processingStatus: "RECONCILIATION_REQUIRED",
          paymentId: payment.id,
          attemptId: attempt.id,
          credentialVersion: attempt.providerCredentialVersion,
          sourceAddress: input.sourceAddress ?? "webhook",
          sourceAddressVerified: true,
          signatureVerified: true,
          merchantVerified: true,
          amountVerified: isAmountMatching,
          providerDataVerified: isVerifiedSuccess,
          safePayloadSnapshot: payload as unknown as Prisma.InputJsonValue,
          unknownFieldCount: 0,
          reconciliationReason: reason,
        },
      });

      await openPaymentReconciliationCaseWithinTransaction(tx, {
        paymentId: payment.id,
        attemptId: attempt.id,
        webhookEventId: event.id,
        provider: "PAYSTACK",
        reason,
        safeEvidence: {
          eventReference: event.publicReference,
          expectedCents,
          receivedCents: actualVerifiedAmount,
          verifiedStatus: verifyData.status ?? (verifiedTx as any).status,
        },
      });

      await tx.payment.update({ where: { id: payment.id }, data: { reconciliationStatus: "REQUIRED" } });
      return Object.freeze({ outcome: "RECONCILIATION_REQUIRED", eventPublicReference: event.publicReference, ledgerJournalReference: null });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  // 6. Handle late success for cancelled or expired attempts (Mandatory Amendment #7)
  if (attempt.status === "CANCELLED" || attempt.status === "EXPIRED") {
    return prisma.$transaction(async (tx) => {
      const event = await tx.paymentWebhookEvent.upsert({
        where: { eventFingerprint },
        update: { processingStatus: "RECONCILIATION_REQUIRED", reconciliationReason: "OUT_OF_ORDER_EVENT" },
        create: {
          publicReference: eventReference(),
          provider: "PAYSTACK",
          environment,
          eventFingerprint,
          merchantReference: reference,
          providerPaymentId: providerIdStr,
          providerStatus: payload.data.status,
          normalizedStatus: "COMPLETE",
          processingStatus: "RECONCILIATION_REQUIRED",
          paymentId: payment.id,
          attemptId: attempt.id,
          credentialVersion: attempt.providerCredentialVersion,
          sourceAddress: input.sourceAddress ?? "webhook",
          sourceAddressVerified: true,
          signatureVerified: true,
          merchantVerified: true,
          amountVerified: true,
          providerDataVerified: true,
          safePayloadSnapshot: payload as unknown as Prisma.InputJsonValue,
          unknownFieldCount: 0,
          reconciliationReason: "OUT_OF_ORDER_EVENT",
          verifiedAt: now,
        },
      });

      await openPaymentReconciliationCaseWithinTransaction(tx, {
        paymentId: payment.id,
        attemptId: attempt.id,
        webhookEventId: event.id,
        provider: "PAYSTACK",
        reason: "OUT_OF_ORDER_EVENT",
        safeEvidence: {
          eventReference: event.publicReference,
          message: `Late success received for ${attempt.status} attempt`,
          reference,
          providerPaymentId: providerIdStr,
        },
      });

      await tx.payment.update({ where: { id: payment.id }, data: { reconciliationStatus: "REQUIRED" } });
      return Object.freeze({ outcome: "RECONCILIATION_REQUIRED", eventPublicReference: event.publicReference, ledgerJournalReference: null });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  // 7. Check if already succeeded / duplicate
  if (attempt.status === "SUCCEEDED" && payment.status === "SUCCEEDED") {
    const existing = await prisma.paymentWebhookEvent.findUnique({ where: { eventFingerprint } });
    if (existing) {
      const journal = existing.ledgerJournalId
        ? await prisma.ledgerJournal.findUnique({ where: { id: existing.ledgerJournalId }, select: { reference: true } })
        : null;
      return Object.freeze({ outcome: "DUPLICATE", eventPublicReference: existing.publicReference, ledgerJournalReference: journal?.reference ?? null });
    }
  }

  // 8. Atomically apply verified payment
  const applyResult = await withPaymentDatabaseRetry(async () => {
    return prisma.$transaction(async (tx) => {
      // Find or create PaymentWebhookEvent
      let event = await tx.paymentWebhookEvent.findUnique({ where: { eventFingerprint } });
      if (event && (event.processingStatus === "APPLIED" || event.processingStatus === "DUPLICATE")) {
        const journal = event.ledgerJournalId ? await tx.ledgerJournal.findUnique({ where: { id: event.ledgerJournalId }, select: { reference: true } }) : null;
        return Object.freeze({ outcome: "DUPLICATE" as const, eventPublicReference: event.publicReference, ledgerJournalReference: journal?.reference ?? null });
      }

      if (!event) {
        event = await tx.paymentWebhookEvent.create({
          data: {
            publicReference: eventReference(),
            provider: "PAYSTACK",
            environment,
            eventFingerprint,
            merchantReference: reference,
            providerPaymentId: providerIdStr,
            providerStatus: payload.data.status,
            normalizedStatus: "COMPLETE",
            processingStatus: "VERIFIED",
            paymentId: payment.id,
            attemptId: attempt.id,
            credentialVersion: attempt.providerCredentialVersion,
            sourceAddress: input.sourceAddress ?? "webhook",
            sourceAddressVerified: true,
            signatureVerified: true,
            merchantVerified: true,
            amountVerified: true,
            providerDataVerified: true,
            safePayloadSnapshot: payload as unknown as Prisma.InputJsonValue,
            unknownFieldCount: 0,
            verifiedAt: now,
          },
        });
      }

      // Consistent lock order: Payment -> PaymentAttempt -> LedgerAccounts
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${attempt.id} FOR UPDATE`);

      const [freshPayment, freshAttempt] = await Promise.all([
        tx.payment.findUnique({ where: { id: payment.id } }),
        tx.paymentAttempt.findUnique({ where: { id: attempt.id } }),
      ]);

      if (!freshPayment || !freshAttempt) {
        throw new PaymentError("PAYSTACK_TRANSACTION_NOT_FOUND", "Payment or attempt could not be reloaded.");
      }

      if (freshAttempt.status === "SUCCEEDED" && freshPayment.status === "SUCCEEDED") {
        await tx.paymentWebhookEvent.update({ where: { id: event.id }, data: { processingStatus: "DUPLICATE", appliedAt: now } });
        return Object.freeze({ outcome: "DUPLICATE" as const, eventPublicReference: event.publicReference, ledgerJournalReference: null });
      }

      // Ledger posting: PLATFORM-CASH-CLEARING-ZAR (Debit) and PLATFORM-CUSTOMER-FUNDS-HELD-ZAR (Credit)
      const accounts = await tx.ledgerAccount.findMany({
        where: {
          wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
          code: { in: ["PLATFORM-CASH-CLEARING-ZAR", "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR"] },
          currency: "ZAR",
          status: "ACTIVE",
        },
        select: { id: true, code: true, purpose: true, category: true },
      });

      const cash = accounts.find((a) => a.code === "PLATFORM-CASH-CLEARING-ZAR" && a.purpose === "CASH_CLEARING" && a.category === "ASSET");
      const held = accounts.find((a) => a.code === "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" && a.purpose === "HELD" && a.category === "LIABILITY");

      if (!cash || !held) {
        throw new PaymentError("PAYMENT_PROVIDER_UNAVAILABLE", "Required payment receipt ledger accounts are unavailable.", true);
      }

      const journal = await postLedgerJournalWithinTransaction(tx, buildPaystackReceiptPosting({
        paymentPublicReference: freshPayment.publicReference,
        attemptPublicReference: freshAttempt.publicReference ?? `attempt-${freshAttempt.attemptNumber}`,
        eventPublicReference: event.publicReference,
        providerPaymentId: providerIdStr,
        amount: freshPayment.amount.toFixed(2),
        cashClearingAccountId: cash.id,
        customerFundsHeldAccountId: held.id,
      }));

      // Update attempt
      await tx.paymentAttempt.update({
        where: { id: freshAttempt.id },
        data: {
          providerReference: providerIdStr,
          providerStatusCode: payload.data.status,
          status: "SUCCEEDED",
          providerConfirmedAt: freshAttempt.providerConfirmedAt ?? now,
          completedAt: now,
          failureCategory: null,
          failureCode: null,
          failureMessage: null,
          version: { increment: 1 },
        },
      });

      // Update payment
      await tx.payment.update({
        where: { id: freshPayment.id },
        data: {
          status: "SUCCEEDED",
          successfulAttemptId: freshAttempt.id,
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

      // Record status history
      await tx.paymentStatusHistory.create({
        data: {
          paymentId: freshPayment.id,
          attemptId: freshAttempt.id,
          fromStatus: freshPayment.status,
          toStatus: "SUCCEEDED",
          reasonCode: "PAYSTACK_VERIFIED_COMPLETE",
          actorType: "PROVIDER",
          metadata: {
            webhookEventReference: event.publicReference,
            providerPaymentId: providerIdStr,
            ledgerJournalReference: journal.reference,
          },
        },
      });

      // Activate cash-on-delivery deposit if applicable
      await activateDepositCashOnDeliveryWithinTransaction(tx, {
        paymentId: freshPayment.id,
        orderId: freshPayment.orderId,
        amount: freshPayment.amount,
        verifiedEventReference: event.publicReference,
      });

      // Resolve open reconciliation cases if any
      await resolvePaymentReconciliationCasesWithinTransaction(tx, freshPayment.id, freshAttempt.id, "VERIFIED_COMPLETE");

      // Update webhook event
      await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: "APPLIED",
          ledgerJournalId: journal.id,
          appliedAt: now,
        },
      });

      // Append verified payment event intent
      await appendVerifiedPaymentEventWithinTransaction(tx, {
        payment: {
          id: freshPayment.id,
          publicReference: freshPayment.publicReference,
          subjectType: freshPayment.subjectType,
          orderId: freshPayment.orderId,
          marketplaceCheckoutId: freshPayment.marketplaceCheckoutId,
          subscriptionInvoiceId: freshPayment.subscriptionInvoiceId,
          managedMarketingRequestId: (freshPayment as any).managedMarketingRequestId,
          userId: freshPayment.userId,
          amount: freshPayment.amount,
          currency: freshPayment.currency,
          successfulAttemptId: freshAttempt.id,
          successWebhookEventId: event.id,
        },
        attemptId: freshAttempt.id,
        webhookEventId: event.id,
        webhookEventReference: event.publicReference,
        verifiedAt: now,
      });

      return Object.freeze({
        outcome: "APPLIED" as const,
        eventPublicReference: event.publicReference,
        ledgerJournalReference: journal.reference,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });

  // Drain outbox asynchronously for immediate downstream effects
  consumeVerifiedPaymentEvents({ limit: 10 }).catch(() => undefined);

  return applyResult;
}
