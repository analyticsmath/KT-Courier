import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { PaymentSubjectType, PaymentWebhookEvent, Prisma } from "@prisma/client";
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

export const PaystackChargeSuccessDataSchema = z.object({
  id: z.union([z.number(), z.string()]),
  domain: z.string().optional(),
  status: z.string(),
  reference: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string(),
  gateway_response: z.string().optional(),
  paid_at: z.string().optional(),
  created_at: z.string().optional(),
  channel: z.string().optional(),
  fees: z.number().nullable().optional(),
  customer: z.object({
    id: z.union([z.number(), z.string()]).optional(),
    email: z.string().optional(),
    customer_code: z.string().optional(),
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const PaystackChargeSuccessPayloadSchema = z.object({
  event: z.literal("charge.success"),
  data: PaystackChargeSuccessDataSchema,
}).passthrough();

export const PaystackRefundDataSchema = z.object({
  id: z.union([z.number(), z.string()]),
  transaction_reference: z.string().optional(),
  reference: z.string().optional(),
  amount: z.number().int().optional(),
  currency: z.string().optional(),
  status: z.string(),
  refunded_by: z.string().optional(),
  refunded_at: z.string().optional(),
  description: z.string().optional(),
  merchant_note: z.string().optional(),
  deducted_amount: z.number().int().optional(),
}).passthrough();

export const PaystackRefundPayloadSchema = z.object({
  event: z.string().refine((val) => val.startsWith("refund."), { message: "Must be a refund event" }),
  data: PaystackRefundDataSchema,
}).passthrough();

export const PaystackGenericPayloadSchema = z.object({
  event: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const PaystackWebhookPayloadSchema = z.union([
  PaystackChargeSuccessPayloadSchema,
  PaystackRefundPayloadSchema,
  PaystackGenericPayloadSchema,
]);

export type PaystackChargeSuccessPayload = z.infer<typeof PaystackChargeSuccessPayloadSchema>;
export type PaystackRefundPayload = z.infer<typeof PaystackRefundPayloadSchema>;
export type PaystackGenericPayload = z.infer<typeof PaystackGenericPayloadSchema>;
export type PaystackWebhookPayload = PaystackChargeSuccessPayload | PaystackRefundPayload | PaystackGenericPayload;

export type IngestPaystackWebhookInput = Readonly<{
  rawBody: string;
  signature: string | null;
  sourceAddress?: string;
  secretKey?: string;
  environment?: PaymentProviderEnvironment;
}>;

export type IngestPaystackWebhookResult = Readonly<{
  received: true;
  duplicate: boolean;
  eventPublicReference: string;
  webhookEventId: string;
  event: string;
  rawRecord?: PaymentWebhookEvent;
  rawPayload?: PaystackWebhookPayload;
}>;

export type ApplyPaystackWebhookEventInput = Readonly<{
  webhookEventId?: string;
  webhookEventReference?: string;
  eventRecord?: Partial<PaymentWebhookEvent> | null;
  rawPayload?: PaystackWebhookPayload;
  secretKey?: string;
  clientOverride?: PaystackClient;
  sourceAddress?: string;
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
    const checkout = payment.marketplaceCheckoutId ? await tx.marketplaceCheckout.findUnique({ where: { id: payment.marketplaceCheckoutId }, select: { publicReference: true } }) : null;
    if (!checkout?.publicReference) throw new PaymentError("PAYSTACK_EVENT_CONFLICT", "Successful marketplace payment is missing its canonical checkout reference.");
    return checkout.publicReference;
  }
  if (payment.subjectType === "SUBSCRIPTION_INVOICE") {
    const invoice = payment.subscriptionInvoiceId ? await tx.subscriptionInvoice.findUnique({ where: { id: payment.subscriptionInvoiceId }, select: { publicReference: true } }) : null;
    if (!invoice?.publicReference) throw new PaymentError("PAYSTACK_EVENT_CONFLICT", "Successful subscription payment is missing its canonical invoice reference.");
    return invoice.publicReference;
  }
  if (payment.subjectType === "MANAGED_MARKETING_REQUEST") {
    const request = payment.managedMarketingRequestId ? await tx.managedMarketingRequest.findUnique({ where: { id: payment.managedMarketingRequestId }, select: { publicReference: true } }) : null;
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
  const eventStore = tx.paymentVerifiedEventIntent;
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
      subjectType: input.payment.subjectType as PaymentSubjectType,
      subjectReference,
      payerUserId: input.payment.userId,
      amount: input.payment.amount,
      currency: "ZAR",
      provider: "PAYSTACK",
      verifiedAt: input.verifiedAt,
      schemaVersion: VERIFIED_PAYMENT_EVENT_SCHEMA_VERSION,
    },
  });
  await tx.notificationEventIntent.upsert({
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

export async function ingestPaystackWebhook(
  input: IngestPaystackWebhookInput,
): Promise<IngestPaystackWebhookResult> {
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

  // 2. Parse payload safely using discriminated schemas
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(input.rawBody);
  } catch {
    throw new PaymentError("PAYSTACK_CONFIGURATION_INVALID", "Paystack webhook payload could not be parsed as JSON.");
  }

  const parsed = PaystackWebhookPayloadSchema.safeParse(rawJson);
  if (!parsed.success) {
    throw new PaymentError("PAYSTACK_CONFIGURATION_INVALID", `Paystack webhook payload validation failed: ${parsed.error.message}`);
  }
  const payload = parsed.data;

  const eventFingerprint = payload.data && "id" in payload.data && payload.data.id
    ? `paystack:${payload.event}:${payload.data.id}`
    : `paystack:${createHash("sha256").update(input.rawBody).digest("hex")}`;

  const existing = await prisma.paymentWebhookEvent.findUnique({ where: { eventFingerprint } });
  if (existing) {
    return Object.freeze({
      received: true as const,
      duplicate: true,
      eventPublicReference: existing.publicReference,
      webhookEventId: existing.id,
      event: payload.event,
      rawRecord: existing,
      rawPayload: payload,
    });
  }

  const dataRecord = (payload.data && typeof payload.data === "object") ? (payload.data as Record<string, unknown>) : undefined;
  const merchantRef = (dataRecord && typeof dataRecord.reference === "string")
    ? dataRecord.reference
    : (dataRecord && typeof dataRecord.transaction_reference === "string"
      ? dataRecord.transaction_reference
      : "unknown");

  const providerPaymentId = (dataRecord && "id" in dataRecord && dataRecord.id !== undefined && dataRecord.id !== null) ? String(dataRecord.id) : "unknown";
  const providerStatus = (dataRecord && typeof dataRecord.status === "string")
    ? dataRecord.status
    : payload.event;

  const isCharge = payload.event === "charge.success";
  const isRefund = payload.event.startsWith("refund.");

  // Fast HTTP ingestion upsert: stores raw event with sourceAddressVerified: false, signatureVerified: true
  const eventRecord = await prisma.paymentWebhookEvent.upsert({
    where: { eventFingerprint },
    update: {},
    create: {
      publicReference: eventReference(),
      provider: "PAYSTACK",
      environment,
      eventFingerprint,
      merchantReference: merchantRef,
      providerPaymentId,
      providerStatus,
      normalizedStatus: isCharge ? "COMPLETE" : "UNKNOWN",
      processingStatus: isCharge ? "RECEIVED" : (isRefund ? "RECEIVED" : "IGNORED_STALE"),
      credentialVersion,
      sourceAddress: input.sourceAddress ?? "webhook",
      sourceAddressVerified: false,
      signatureVerified: true,
      merchantVerified: false,
      amountVerified: false,
      providerDataVerified: isRefund ? true : false,
      safePayloadSnapshot: payload as unknown as Prisma.InputJsonValue,
      unknownFieldCount: 0,
    },
  });

  const duplicate = eventRecord.processingStatus === "APPLIED" || eventRecord.processingStatus === "DUPLICATE";

  return Object.freeze({
    received: true as const,
    duplicate,
    eventPublicReference: eventRecord.publicReference,
    webhookEventId: eventRecord.id,
    event: payload.event,
    rawRecord: eventRecord,
    rawPayload: payload,
  });
}

export async function applyPaystackWebhookEvent(
  input: ApplyPaystackWebhookEventInput,
): Promise<PaystackWebhookApplicationResult> {
  const secretKey = input.secretKey
    ?? process.env.PAYSTACK_SECRET_KEY?.trim()
    ?? resolvePaystackConfiguration().runtime?.secretKey;
  if (!secretKey) {
    throw new PaymentError("PAYSTACK_NOT_CONFIGURED", "Paystack secret key is not configured.");
  }

  let event: Partial<PaymentWebhookEvent> | null = input.eventRecord ?? null;
  if (!event) {
    event = input.webhookEventId
      ? await prisma.paymentWebhookEvent.findUnique({ where: { id: input.webhookEventId } })
      : input.webhookEventReference
        ? await prisma.paymentWebhookEvent.findUnique({ where: { publicReference: input.webhookEventReference } })
        : null;
  }

  const payload = (input.rawPayload ?? (event?.safePayloadSnapshot as unknown as PaystackWebhookPayload)) as PaystackWebhookPayload | undefined;
  if (!payload || payload.event !== "charge.success" || !payload.data) {
    return Object.freeze({
      outcome: "IGNORED_NON_CHARGE",
      eventPublicReference: event?.publicReference ?? "unknown",
      ledgerJournalReference: null,
    });
  }

  const chargePayload = payload as PaystackChargeSuccessPayload;
  const { reference, amount: amountCents, currency, id: providerPaymentId } = chargePayload.data;
  const providerIdStr = String(providerPaymentId);
  const eventFingerprint = chargePayload.data && "id" in chargePayload.data && chargePayload.data.id
    ? `paystack:${chargePayload.event}:${chargePayload.data.id}`
    : (event?.eventFingerprint ?? `paystack:${providerIdStr}`);

  // Look up matching PaymentAttempt by publicReference
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { publicReference: reference },
    include: { payment: true },
  });

  const now = new Date();

  // If attempt is completely unknown
  if (!attempt) {
    const upserted = await prisma.paymentWebhookEvent.upsert({
      where: { eventFingerprint },
      update: {
        processingStatus: "RECONCILIATION_REQUIRED",
        reconciliationReason: "PROVIDER_REFERENCE_CONFLICT",
      },
      create: {
        publicReference: event?.publicReference ?? eventReference(),
        provider: "PAYSTACK",
        environment: event?.environment ?? "SANDBOX",
        eventFingerprint,
        merchantReference: reference,
        providerPaymentId: providerIdStr,
        providerStatus: chargePayload.data.status,
        normalizedStatus: "UNKNOWN",
        processingStatus: "RECONCILIATION_REQUIRED",
        credentialVersion: event?.credentialVersion ?? "test-v1",
        sourceAddress: input.sourceAddress ?? "webhook",
        sourceAddressVerified: false,
        signatureVerified: true,
        merchantVerified: false,
        amountVerified: false,
        providerDataVerified: false,
        safePayloadSnapshot: payload as unknown as Prisma.InputJsonValue,
        unknownFieldCount: 0,
        reconciliationReason: "PROVIDER_REFERENCE_CONFLICT",
      },
    });
    return Object.freeze({ outcome: "RECONCILIATION_REQUIRED", eventPublicReference: upserted.publicReference, ledgerJournalReference: null });
  }

  const payment = attempt.payment;

  // Secondary confirmation via Verify API
  const client = input.clientOverride ?? new PaystackClient({ secretKey });
  let verifiedTx: Awaited<ReturnType<typeof client.verifyTransaction>>;
  try {
    verifiedTx = await client.verifyTransaction(reference);
  } catch (error) {
    throw new PaymentError("PAYSTACK_VERIFICATION_FAILED", "Paystack transaction verification call failed.", true, { cause: error });
  }

  const rawVerifyObj = verifiedTx as unknown as Record<string, unknown>;
  const verifyData = (rawVerifyObj && typeof rawVerifyObj.data === "object" && rawVerifyObj.data !== null)
    ? (rawVerifyObj.data as Record<string, unknown>)
    : rawVerifyObj;
  const verifyStatus = typeof verifyData?.status === "string" ? verifyData.status : undefined;
  const verifyCurrency = typeof verifyData?.currency === "string" ? verifyData.currency : undefined;
  const verifyAmount = typeof verifyData?.amount === "number" ? verifyData.amount : undefined;

  const isVerifiedSuccess = verifyStatus === "success";
  const isCurrencyZar = verifyCurrency === "ZAR" && currency === "ZAR";
  const expectedCents = zarToSubunitCents(attempt.amount.toString());
  const actualVerifiedAmount = verifyAmount ?? -1;
  const isAmountMatching = actualVerifiedAmount === amountCents && actualVerifiedAmount === expectedCents;

  if (!isVerifiedSuccess || !isCurrencyZar || !isAmountMatching) {
    const reason: PaymentReconciliationReasonCode = !isCurrencyZar
      ? "AMOUNT_MISMATCH"
      : !isAmountMatching
        ? "AMOUNT_MISMATCH"
        : "CONFLICTING_PROVIDER_STATUS";

    return prisma.$transaction(async (tx) => {
      const upserted = await tx.paymentWebhookEvent.upsert({
        where: { eventFingerprint },
        update: {
          processingStatus: "RECONCILIATION_REQUIRED",
          reconciliationReason: reason,
          paymentId: payment.id,
          attemptId: attempt.id,
          merchantVerified: true,
          amountVerified: isAmountMatching,
          providerDataVerified: isVerifiedSuccess,
          normalizedStatus: (isVerifiedSuccess ? "COMPLETE" : "FAILED") as PaymentWebhookNormalizedStatusCode,
        },
        create: {
          publicReference: event?.publicReference ?? eventReference(),
          provider: "PAYSTACK",
          environment: event?.environment ?? "SANDBOX",
          eventFingerprint,
          merchantReference: reference,
          providerPaymentId: providerIdStr,
          providerStatus: chargePayload.data.status,
          normalizedStatus: (isVerifiedSuccess ? "COMPLETE" : "FAILED") as PaymentWebhookNormalizedStatusCode,
          processingStatus: "RECONCILIATION_REQUIRED",
          paymentId: payment.id,
          attemptId: attempt.id,
          credentialVersion: attempt.providerCredentialVersion,
          sourceAddress: input.sourceAddress ?? "webhook",
          sourceAddressVerified: false,
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
        webhookEventId: upserted.id,
        provider: "PAYSTACK",
        reason,
        safeEvidence: {
          eventReference: upserted.publicReference,
          expectedCents,
          receivedCents: actualVerifiedAmount,
          verifiedStatus: verifyStatus ?? "UNKNOWN",
        },
      });

      await tx.payment.update({ where: { id: payment.id }, data: { reconciliationStatus: "REQUIRED" } });
      return Object.freeze({ outcome: "RECONCILIATION_REQUIRED", eventPublicReference: upserted.publicReference, ledgerJournalReference: null });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  // Handle late success for cancelled or expired attempts
  if (attempt.status === "CANCELLED" || attempt.status === "EXPIRED") {
    return prisma.$transaction(async (tx) => {
      const upserted = await tx.paymentWebhookEvent.upsert({
        where: { eventFingerprint },
        update: {
          processingStatus: "RECONCILIATION_REQUIRED",
          reconciliationReason: "OUT_OF_ORDER_EVENT",
          paymentId: payment.id,
          attemptId: attempt.id,
          merchantVerified: true,
          amountVerified: true,
          providerDataVerified: true,
          normalizedStatus: "COMPLETE",
          verifiedAt: now,
        },
        create: {
          publicReference: event?.publicReference ?? eventReference(),
          provider: "PAYSTACK",
          environment: event?.environment ?? "SANDBOX",
          eventFingerprint,
          merchantReference: reference,
          providerPaymentId: providerIdStr,
          providerStatus: chargePayload.data.status,
          normalizedStatus: "COMPLETE",
          processingStatus: "RECONCILIATION_REQUIRED",
          paymentId: payment.id,
          attemptId: attempt.id,
          credentialVersion: attempt.providerCredentialVersion,
          sourceAddress: input.sourceAddress ?? "webhook",
          sourceAddressVerified: false,
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
        webhookEventId: upserted.id,
        provider: "PAYSTACK",
        reason: "OUT_OF_ORDER_EVENT",
        safeEvidence: {
          eventReference: upserted.publicReference,
          message: `Late success received for ${attempt.status} attempt`,
          reference,
          providerPaymentId: providerIdStr,
        },
      });

      await tx.payment.update({ where: { id: payment.id }, data: { reconciliationStatus: "REQUIRED" } });
      return Object.freeze({ outcome: "RECONCILIATION_REQUIRED", eventPublicReference: upserted.publicReference, ledgerJournalReference: null });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  const resolvedEvent: PaymentWebhookEvent = (event?.id && event?.publicReference)
    ? (event as PaymentWebhookEvent)
    : await prisma.paymentWebhookEvent.upsert({
        where: { eventFingerprint },
        update: {},
        create: {
          publicReference: event?.publicReference ?? eventReference(),
          provider: "PAYSTACK",
          environment: event?.environment ?? "SANDBOX",
          eventFingerprint,
          merchantReference: reference,
          providerPaymentId: providerIdStr,
          providerStatus: chargePayload.data.status,
          normalizedStatus: "COMPLETE",
          processingStatus: "RECEIVED",
          credentialVersion: attempt.providerCredentialVersion,
          sourceAddress: input.sourceAddress ?? "webhook",
          sourceAddressVerified: false,
          signatureVerified: true,
          merchantVerified: true,
          amountVerified: true,
          providerDataVerified: true,
          safePayloadSnapshot: payload as unknown as Prisma.InputJsonValue,
          unknownFieldCount: 0,
        },
      });

  // Check if already succeeded / duplicate
  if (attempt.status === "SUCCEEDED" && payment.status === "SUCCEEDED") {
    const existing = (resolvedEvent && (resolvedEvent.ledgerJournalId !== undefined || resolvedEvent.id))
      ? resolvedEvent
      : await prisma.paymentWebhookEvent.findUnique({ where: { eventFingerprint } });
    if (existing) {
      const journal = existing.ledgerJournalId
        ? await prisma.ledgerJournal.findUnique({ where: { id: existing.ledgerJournalId }, select: { reference: true } })
        : null;
      return Object.freeze({ outcome: "DUPLICATE", eventPublicReference: existing.publicReference, ledgerJournalReference: journal?.reference ?? null });
    }
  }

  // Atomically apply verified payment
  const applyResult = await withPaymentDatabaseRetry(async () => {
    return prisma.$transaction(async (tx) => {
      // Find or verify PaymentWebhookEvent status
      const freshEvent = await tx.paymentWebhookEvent.findUnique({ where: { id: resolvedEvent.id } });
      if (freshEvent && (freshEvent.processingStatus === "APPLIED" || freshEvent.processingStatus === "DUPLICATE")) {
        const journal = freshEvent.ledgerJournalId ? await tx.ledgerJournal.findUnique({ where: { id: freshEvent.ledgerJournalId }, select: { reference: true } }) : null;
        return Object.freeze({ outcome: "DUPLICATE" as const, eventPublicReference: freshEvent.publicReference, ledgerJournalReference: journal?.reference ?? null });
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
        await tx.paymentWebhookEvent.update({ where: { id: resolvedEvent.id }, data: { processingStatus: "DUPLICATE", appliedAt: now } });
        return Object.freeze({ outcome: "DUPLICATE" as const, eventPublicReference: resolvedEvent.publicReference, ledgerJournalReference: null });
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
        eventPublicReference: resolvedEvent.publicReference,
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
          providerStatusCode: chargePayload.data.status,
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
          successWebhookEventId: resolvedEvent.id,
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
            webhookEventReference: resolvedEvent.publicReference,
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
        verifiedEventReference: resolvedEvent.publicReference,
      });

      // Resolve open reconciliation cases if any
      await resolvePaymentReconciliationCasesWithinTransaction(tx, freshPayment.id, freshAttempt.id, "VERIFIED_COMPLETE");

      // Update webhook event
      await tx.paymentWebhookEvent.update({
        where: { id: resolvedEvent.id },
        data: {
          processingStatus: "APPLIED",
          ledgerJournalId: journal.id,
          paymentId: freshPayment.id,
          attemptId: freshAttempt.id,
          merchantVerified: true,
          amountVerified: true,
          providerDataVerified: true,
          normalizedStatus: "COMPLETE",
          appliedAt: now,
          verifiedAt: now,
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
          managedMarketingRequestId: freshPayment.managedMarketingRequestId,
          userId: freshPayment.userId,
          amount: freshPayment.amount,
          currency: freshPayment.currency,
          successfulAttemptId: freshAttempt.id,
          successWebhookEventId: resolvedEvent.id,
        },
        attemptId: freshAttempt.id,
        webhookEventId: resolvedEvent.id,
        webhookEventReference: resolvedEvent.publicReference,
        verifiedAt: now,
      });

      return Object.freeze({
        outcome: "APPLIED" as const,
        eventPublicReference: resolvedEvent.publicReference,
        ledgerJournalReference: journal.reference,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });

  // Drain outbox asynchronously for immediate downstream effects
  consumeVerifiedPaymentEvents({ limit: 10 }).catch(() => undefined);

  return applyResult;
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
  const ingest = await ingestPaystackWebhook(input);
  if (ingest.event !== "charge.success") {
    return Object.freeze({
      outcome: "IGNORED_NON_CHARGE",
      eventPublicReference: ingest.eventPublicReference,
      ledgerJournalReference: null,
    });
  }
  return applyPaystackWebhookEvent({
    webhookEventId: ingest.webhookEventId,
    eventRecord: ingest.rawRecord,
    rawPayload: ingest.rawPayload,
    clientOverride: input.clientOverride,
    sourceAddress: input.sourceAddress,
    secretKey: input.secretKey,
  });
}
