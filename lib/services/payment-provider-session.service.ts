/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 20 delegates remain dynamic until Prisma generation is permitted. */
import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ProviderSessionDto } from "@/lib/dto/payment.dto";
import { PaymentError } from "@/lib/payments/errors";
import { canonicalPaymentHash } from "@/lib/payments/hash";
import { createMerchantReference } from "@/lib/payments/merchant-reference";
import { toPaymentAttemptDto } from "@/lib/payments/payment-dto-mappers";
import { assertPaymentAttemptTransition } from "@/lib/payments/payment-attempt-state-machine";
import { assertPaymentTransition } from "@/lib/payments/payment-state-machine";
import { sanitizeProviderSnapshot } from "@/lib/payments/provider-snapshot-policy";
import { PaymentProviderRegistry, createProductionPaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import type {
  PaymentProviderAdapter,
  ProviderCheckoutSessionInput,
  ProviderCheckoutSessionResult,
} from "@/lib/payments/providers/payment-provider-adapter";
import {
  definitiveProviderError,
  normalizeProviderError,
  type NormalizedProviderError,
} from "@/lib/payments/providers/provider-errors";
import { validateProviderResult, type ValidatedProviderResult } from "@/lib/payments/providers/provider-result-validation";
import { buildServerPaymentCallbackUrls, type PaymentCallbackUrls } from "@/lib/payments/return-url-policy";
import { withPaymentDatabaseRetry } from "@/lib/payments/retry";
import { PAYMENT_SESSION_POLICY_VERSION, type PaymentAttemptState, type PaymentState } from "@/lib/payments/types";
import { CreateProviderSessionSchema, type CreateProviderSessionInput } from "@/lib/validation/payments";
import { assertPaymentSubjectIntegrity } from "@/lib/payments/payment-subject-policy";

const DEFAULT_TIMEOUT_MS = 10_000;
const UNRESOLVED_ATTEMPTS = ["RESERVED", "REQUESTING", "REQUIRES_ACTION", "PROCESSING", "UNKNOWN"] as const;

type SessionDependencies = Readonly<{
  registry?: PaymentProviderRegistry;
  callbackUrls?: (publicReference: string) => PaymentCallbackUrls;
  timeoutMs?: number;
}>;

type ReservedAttemptRecord = Parameters<typeof toPaymentAttemptDto>[0] & Readonly<{
  paymentId: string;
  idempotencyKey: string;
  requestHash: string;
  version: number;
}>;

type ReservedSession = Readonly<{
  paymentId: string;
  paymentStatus: PaymentState;
  paymentPublicReference: string;
  payerUserId: string;
  payerEmail: string;
  payerName: string | null;
  orderReference: string;
  amount: string;
  currency: "ZAR";
  description: string;
  attempt: ReservedAttemptRecord;
  requestHash: string;
  callbackUrls: PaymentCallbackUrls;
  replayed: boolean;
}>;

function safeCustomerReference(userId: string): string {
  return `payer_${createHash("sha256").update(userId).digest("hex").slice(0, 20)}`;
}

function newPublicAttemptReference(): string {
  return `pat_${randomBytes(18).toString("base64url")}`;
}

function validPayerEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function providerRequestInput(reservation: ReservedSession): ProviderCheckoutSessionInput {
  return Object.freeze({
    merchantReference: reservation.attempt.merchantReference,
    paymentPublicReference: reservation.paymentPublicReference,
    amount: reservation.amount,
    currency: "ZAR",
    customerReference: safeCustomerReference(reservation.payerUserId),
    customerEmail: reservation.payerEmail,
    ...(reservation.payerName ? { customerName: reservation.payerName } : {}),
    orderReference: reservation.orderReference,
    returnUrl: reservation.callbackUrls.returnUrl,
    cancelUrl: reservation.callbackUrls.cancelUrl,
    notificationUrl: reservation.callbackUrls.notificationUrl,
    description: reservation.description,
    providerOperationKey: reservation.attempt.merchantReference,
  });
}

function attemptHash(args: {
  paymentId: string;
  provider: "PAYFAST";
  amount: string;
  currency: "ZAR";
  callbackUrls: PaymentCallbackUrls;
  description: string;
  configurationFingerprint: string;
}): string {
  return canonicalPaymentHash({
    paymentId: args.paymentId,
    provider: args.provider,
    amount: args.amount,
    currency: args.currency,
    merchantReferenceSemantics: "kt:payment:<public-reference>:attempt:<locked-counter>",
    returnRouteId: args.callbackUrls.returnRouteId,
    cancelRouteId: args.callbackUrls.cancelRouteId,
    notificationRouteId: args.callbackUrls.notificationRouteId,
    description: args.description,
    configurationFingerprint: args.configurationFingerprint,
    policyVersion: PAYMENT_SESSION_POLICY_VERSION,
  });
}

function sessionDto(args: {
  paymentId: string;
  paymentStatus: string;
  attempt: Parameters<typeof toPaymentAttemptDto>[0];
  replayed: boolean;
}): ProviderSessionDto {
  return Object.freeze({
    paymentId: args.paymentId,
    paymentStatus: args.paymentStatus as PaymentState,
    attempt: toPaymentAttemptDto(args.attempt),
    replayed: args.replayed,
  });
}

async function reserveAttempt(
  payerId: string,
  input: CreateProviderSessionInput,
  callbackUrlFactory: (publicReference: string) => PaymentCallbackUrls,
  adapter: PaymentProviderAdapter,
) {
  return withPaymentDatabaseRetry(() => prisma.$transaction(async (tx) => {
    const paymentBeforeLock = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        order: { select: { orderNumber: true } },
        user: { select: { email: true, name: true } },
      },
    });
    if (!paymentBeforeLock) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment was not found.");
    if (paymentBeforeLock.userId !== payerId) {
      throw new PaymentError("PAYMENT_PAYER_NOT_AUTHORIZED", "Payment is not available for this payer.");
    }
    if (!paymentBeforeLock.user?.email || !validPayerEmail(paymentBeforeLock.user.email)) {
      throw new PaymentError("PAYFAST_PAYER_EMAIL_REQUIRED", "A valid payer email is required for Payfast checkout.");
    }

    const callbackUrls = callbackUrlFactory(paymentBeforeLock.publicReference);
    const description = `KT Couriers order ${paymentBeforeLock.order?.orderNumber ?? paymentBeforeLock.publicReference}`.slice(0, 160);
    const requestHash = attemptHash({
      paymentId: paymentBeforeLock.id,
      provider: input.provider,
      amount: paymentBeforeLock.amount.toFixed(2),
      currency: "ZAR",
      callbackUrls,
      description,
      configurationFingerprint: adapter.checkoutAudit.configurationFingerprint,
    });

    const existing = await tx.paymentAttempt.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.paymentId !== paymentBeforeLock.id || existing.requestHash !== requestHash) {
        throw new PaymentError("PAYMENT_ATTEMPT_IDEMPOTENCY_CONFLICT", "Provider-session key was reused for a different request.");
      }
      return {
        paymentId: paymentBeforeLock.id,
        paymentStatus: paymentBeforeLock.status as PaymentState,
        paymentPublicReference: paymentBeforeLock.publicReference,
        payerUserId: paymentBeforeLock.userId,
        payerEmail: (paymentBeforeLock.user?.email ?? "").trim().toLowerCase(),
        payerName: paymentBeforeLock.user?.name ?? null,
        orderReference: paymentBeforeLock.order?.orderNumber ?? paymentBeforeLock.publicReference,
        amount: paymentBeforeLock.amount.toFixed(2),
        currency: "ZAR" as const,
        description,
        attempt: existing,
        requestHash,
        callbackUrls,
        replayed: true,
      };
    }

    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${input.paymentId} FOR UPDATE`);
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        order: { select: { orderNumber: true } },
        user: { select: { email: true, name: true } },
      },
    });
    if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment was not found.");
    if (payment.userId !== payerId) throw new PaymentError("PAYMENT_PAYER_NOT_AUTHORIZED", "Payment is not available for this payer.");
    if (!payment.user?.email || !validPayerEmail(payment.user.email)) throw new PaymentError("PAYFAST_PAYER_EMAIL_REQUIRED", "A valid payer email is required for Payfast checkout.");
    if (payment.amount.toFixed(2) !== paymentBeforeLock.amount.toFixed(2) || payment.currency !== "ZAR") {
      throw new PaymentError("PAYMENT_CONCURRENCY_CONFLICT", "Payment financial identity changed during reservation.");
    }
    if (!(["CREATED", "FAILED", "EXPIRED"] as const).includes(payment.status as "CREATED" | "FAILED" | "EXPIRED")) {
      throw new PaymentError("PAYMENT_STATE_TRANSITION_INVALID", "Payment does not permit a new provider attempt.");
    }
    const unresolved = await tx.paymentAttempt.findFirst({
      where: { paymentId: payment.id, status: { in: [...UNRESOLVED_ATTEMPTS] } },
      select: { id: true },
    });
    if (unresolved) throw new PaymentError("PAYMENT_PROVIDER_OUTCOME_UNKNOWN", "Payment already has an unresolved provider attempt.");

    const nextAttemptNumber = payment.latestAttemptNumber + 1;
    const merchantReference = createMerchantReference(payment.publicReference, nextAttemptNumber);
    assertPaymentTransition(payment.status as PaymentState, "PROVIDER_PENDING");
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, version: payment.version },
      data: {
        provider: input.provider,
        status: "PROVIDER_PENDING",
        latestAttemptNumber: nextAttemptNumber,
        version: { increment: 1 },
        failedAt: null,
        expiresAt: null,
      },
    });
    if (updated.count !== 1) throw new PaymentError("PAYMENT_CONCURRENCY_CONFLICT", "Payment reservation lost a concurrent update.", true);

    const attempt = await tx.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        publicReference: newPublicAttemptReference(),
        attemptNumber: nextAttemptNumber,
        provider: input.provider,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        merchantReference,
        status: "RESERVED",
        amount: payment.amount,
        currency: "ZAR",
        providerEnvironment: adapter.checkoutAudit.environment,
        providerProtocolVersion: adapter.checkoutAudit.protocolVersion,
        configurationFingerprint: adapter.checkoutAudit.configurationFingerprint,
        providerCredentialVersion: adapter.checkoutAudit.credentialVersion,
        version: 0,
      },
    });
    await tx.paymentStatusHistory.create({
      data: {
        paymentId: payment.id,
        attemptId: attempt.id,
        fromStatus: payment.status,
        toStatus: "PROVIDER_PENDING",
        reasonCode: "PROVIDER_ATTEMPT_RESERVED",
        actorType: "PAYER",
        actorId: payerId,
        metadata: { provider: input.provider, attemptNumber: nextAttemptNumber },
      },
    });

    return {
      paymentId: payment.id,
      paymentStatus: "PROVIDER_PENDING" as const,
      paymentPublicReference: payment.publicReference,
      payerUserId: payment.userId,
      payerEmail: (payment.user?.email ?? "").trim().toLowerCase(),
      payerName: payment.user?.name ?? null,
      orderReference: payment.order?.orderNumber ?? payment.publicReference,
      amount: payment.amount.toFixed(2),
      currency: "ZAR" as const,
      description,
      attempt,
      requestHash,
      callbackUrls,
      replayed: false,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

async function reserveMarketplaceAttempt(
  input: Readonly<{ paymentId: string; idempotencyKey: string; payerEmail: string; guestCheckoutEvidence: boolean }>,
  callbackUrlFactory: (publicReference: string) => PaymentCallbackUrls,
  adapter: PaymentProviderAdapter,
): Promise<ReservedSession> {
  const db = prisma as any;
  return withPaymentDatabaseRetry(() => db.$transaction(async (tx: any) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${input.paymentId} FOR UPDATE`);
    const payment = await tx.payment.findUnique({ where: { id: input.paymentId }, include: { marketplaceCheckout: true } });
    if (!payment || !payment.marketplaceCheckout) throw new PaymentError("PAYMENT_NOT_FOUND", "Marketplace payment was not found.");
    assertPaymentSubjectIntegrity({ subjectType: payment.subjectType, userId: payment.userId, orderId: payment.orderId, marketplaceCheckoutId: payment.marketplaceCheckoutId, marketplaceOrderId: payment.marketplaceOrderId, checkoutCustomerUserId: payment.marketplaceCheckout.customerUserId, checkoutGuestAccessTokenHash: payment.marketplaceCheckout.guestAccessTokenHash });
    if (payment.subjectType !== "MARKETPLACE_CHECKOUT" || payment.currency !== "ZAR" || !validPayerEmail(input.payerEmail)) throw new PaymentError("PAYFAST_PAYER_EMAIL_REQUIRED", "A valid marketplace payer email is required.");
    if (!payment.marketplaceCheckout.customerUserId && !input.guestCheckoutEvidence) throw new PaymentError("PAYMENT_PAYER_NOT_AUTHORIZED", "Guest checkout ownership evidence is required.");
    const callbackUrls = callbackUrlFactory(payment.publicReference);
    const description = `KT Couriers marketplace checkout ${payment.marketplaceCheckout.publicReference}`.slice(0, 160);
    const requestHash = attemptHash({ paymentId: payment.id, provider: "PAYFAST", amount: payment.amount.toFixed(2), currency: "ZAR", callbackUrls, description, configurationFingerprint: adapter.checkoutAudit.configurationFingerprint });
    const existing = await tx.paymentAttempt.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    const payerUserId = payment.userId ?? `guest:${payment.marketplaceCheckout.id}`;
    if (existing) {
      if (existing.paymentId !== payment.id || existing.requestHash !== requestHash) throw new PaymentError("PAYMENT_ATTEMPT_IDEMPOTENCY_CONFLICT", "Provider-session key was reused for different marketplace evidence.");
      return { paymentId: payment.id, paymentStatus: payment.status as PaymentState, paymentPublicReference: payment.publicReference, payerUserId, payerEmail: input.payerEmail.trim().toLowerCase(), payerName: null, orderReference: payment.marketplaceCheckout.publicReference, amount: payment.amount.toFixed(2), currency: "ZAR", description, attempt: existing, requestHash, callbackUrls, replayed: true } as ReservedSession;
    }
    if (!( ["CREATED", "FAILED", "EXPIRED"] as string[]).includes(payment.status)) throw new PaymentError("PAYMENT_STATE_TRANSITION_INVALID", "Marketplace payment does not permit a new provider attempt.");
    const unresolved = await tx.paymentAttempt.findFirst({ where: { paymentId: payment.id, status: { in: [...UNRESOLVED_ATTEMPTS] } }, select: { id: true } });
    if (unresolved) throw new PaymentError("PAYMENT_PROVIDER_OUTCOME_UNKNOWN", "Marketplace payment already has an unresolved provider attempt.");
    const nextAttemptNumber = payment.latestAttemptNumber + 1;
    const merchantReference = createMerchantReference(payment.publicReference, nextAttemptNumber);
    assertPaymentTransition(payment.status as PaymentState, "PROVIDER_PENDING");
    const updated = await tx.payment.updateMany({ where: { id: payment.id, version: payment.version, status: payment.status }, data: { provider: "PAYFAST", status: "PROVIDER_PENDING", latestAttemptNumber: nextAttemptNumber, version: { increment: 1 }, failedAt: null, expiresAt: null } });
    if (updated.count !== 1) throw new PaymentError("PAYMENT_CONCURRENCY_CONFLICT", "Marketplace payment reservation lost a concurrent update.", true);
    const attempt = await tx.paymentAttempt.create({ data: { paymentId: payment.id, publicReference: newPublicAttemptReference(), attemptNumber: nextAttemptNumber, provider: "PAYFAST", idempotencyKey: input.idempotencyKey, requestHash, merchantReference, status: "RESERVED", amount: payment.amount, currency: "ZAR", providerEnvironment: adapter.checkoutAudit.environment, providerProtocolVersion: adapter.checkoutAudit.protocolVersion, configurationFingerprint: adapter.checkoutAudit.configurationFingerprint, providerCredentialVersion: adapter.checkoutAudit.credentialVersion, version: 0 } });
    await tx.paymentStatusHistory.create({ data: { paymentId: payment.id, attemptId: attempt.id, fromStatus: payment.status, toStatus: "PROVIDER_PENDING", reasonCode: "MARKETPLACE_PROVIDER_ATTEMPT_RESERVED", actorType: payment.userId ? "PAYER" : "SYSTEM", actorId: payment.userId, metadata: { provider: "PAYFAST", attemptNumber: nextAttemptNumber, checkoutReference: payment.marketplaceCheckout.publicReference } } });
    return { paymentId: payment.id, paymentStatus: "PROVIDER_PENDING", paymentPublicReference: payment.publicReference, payerUserId, payerEmail: input.payerEmail.trim().toLowerCase(), payerName: null, orderReference: payment.marketplaceCheckout.publicReference, amount: payment.amount.toFixed(2), currency: "ZAR", description, attempt, requestHash, callbackUrls, replayed: false } as ReservedSession;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

async function markAttemptRequesting(attemptId: string): Promise<void> {
  await withPaymentDatabaseRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${attemptId} FOR UPDATE`);
    const attempt = await tx.paymentAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new PaymentError("PAYMENT_ATTEMPT_NOT_FOUND", "Payment attempt was not found.");
    if (attempt.status !== "RESERVED") return;
    assertPaymentAttemptTransition("RESERVED", "REQUESTING");
    const updated = await tx.paymentAttempt.updateMany({
      where: { id: attempt.id, version: attempt.version, status: "RESERVED" },
      data: { status: "REQUESTING", startedAt: new Date(), version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new PaymentError("PAYMENT_CONCURRENCY_CONFLICT", "Payment attempt request marker lost a concurrent update.", true);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

type FinalOutcome =
  | { kind: "result"; result: ValidatedProviderResult }
  | { kind: "error"; error: NormalizedProviderError };

function outcomeAttemptStatus(outcome: FinalOutcome): PaymentAttemptState {
  if (outcome.kind === "error") return outcome.error.definitive ? "FAILED" : "UNKNOWN";
  if (!outcome.result.definitive && ["FAILED", "CANCELLED", "EXPIRED", "UNKNOWN"].includes(outcome.result.status)) return "UNKNOWN";
  return outcome.result.status;
}

function paymentTargetForAttempt(status: PaymentAttemptState): PaymentState {
  switch (status) {
    case "REQUIRES_ACTION": return "REQUIRES_ACTION";
    case "PROCESSING":
    case "UNKNOWN": return "PROCESSING";
    case "SUCCEEDED": return "SUCCEEDED";
    case "FAILED": return "FAILED";
    case "CANCELLED": return "CANCELLED";
    case "EXPIRED": return "EXPIRED";
    default: throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Provider result cannot finalize this attempt.");
  }
}

async function finalizeAttempt(
  reservation: ReservedSession,
  request: ProviderCheckoutSessionInput,
  outcome: FinalOutcome,
): Promise<ProviderSessionDto> {
  try {
    return await withPaymentDatabaseRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${reservation.paymentId} FOR UPDATE`);
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${reservation.attempt.id} FOR UPDATE`);
    const [payment, attempt] = await Promise.all([
      tx.payment.findUnique({ where: { id: reservation.paymentId } }),
      tx.paymentAttempt.findUnique({ where: { id: reservation.attempt.id } }),
    ]);
    if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment was not found during provider finalization.");
    if (!attempt) throw new PaymentError("PAYMENT_ATTEMPT_NOT_FOUND", "Payment attempt was not found during provider finalization.");

    const targetAttemptStatus = outcomeAttemptStatus(outcome);
    const targetPaymentStatus = paymentTargetForAttempt(targetAttemptStatus);
    if (!["RESERVED", "REQUESTING"].includes(attempt.status)) {
      if (attempt.status === targetAttemptStatus) return sessionDto({ paymentId: payment.id, paymentStatus: payment.status, attempt, replayed: true });
      throw new PaymentError("PAYMENT_CONCURRENCY_CONFLICT", "Payment attempt was finalized with an incompatible result.");
    }
    if (attempt.paymentId !== payment.id || attempt.requestHash !== reservation.requestHash) {
      throw new PaymentError("PAYMENT_CONCURRENCY_CONFLICT", "Payment attempt identity does not match its reservation.");
    }

    assertPaymentAttemptTransition(attempt.status as PaymentAttemptState, targetAttemptStatus);
    const now = new Date();
    const result = outcome.kind === "result" ? outcome.result : null;
    const failure = outcome.kind === "error"
      ? outcome.error
      : targetAttemptStatus === "FAILED"
        ? definitiveProviderError("DECLINED", result?.providerStatusCode ?? "PROVIDER_REJECTED")
        : null;
    const requestSnapshot = sanitizeProviderSnapshot({
      provider: "PAYFAST",
      environment: attempt.providerEnvironment,
      merchantReference: request.merchantReference,
      paymentPublicReference: request.paymentPublicReference,
      amount: request.amount,
      currency: request.currency,
      customerReference: request.customerReference,
      orderReference: request.orderReference,
      returnRouteId: reservation.callbackUrls.returnRouteId,
      cancelRouteId: reservation.callbackUrls.cancelRouteId,
      notificationRouteId: reservation.callbackUrls.notificationRouteId,
      description: request.description,
      fieldVersion: attempt.providerProtocolVersion,
      configurationFingerprint: attempt.configurationFingerprint,
      policyVersion: PAYMENT_SESSION_POLICY_VERSION,
    });
    const resultSnapshot = sanitizeProviderSnapshot(result ? {
      status: result.status,
      providerReference: result.providerReference ?? null,
      providerStatusCode: result.providerStatusCode ?? null,
      providerTimestamp: result.providerTimestamp?.toISOString() ?? null,
      customerActionType: result.customerAction?.type ?? null,
      definitive: result.definitive,
      metadata: result.safeMetadata ?? null,
    } : {
      category: failure?.category ?? "UNKNOWN_OUTCOME",
      code: failure?.code ?? "PROVIDER_OUTCOME_UNKNOWN",
      definitive: failure?.definitive ?? false,
    });

    const attemptUpdate = await tx.paymentAttempt.updateMany({
      where: { id: attempt.id, version: attempt.version, status: attempt.status },
      data: {
        status: targetAttemptStatus,
        providerReference: result?.providerReference ?? attempt.providerReference,
        redirectUrl: result?.customerAction?.type === "REDIRECT_GET" ? result.customerAction.url : null,
        checkoutActionType: result?.customerAction?.type ?? null,
        checkoutPreparedAt: result?.customerAction ? now : null,
        expiresAt: result?.customerAction?.expiresAt ? new Date(result.customerAction.expiresAt) : null,
        providerStatusCode: result?.providerStatusCode ?? null,
        failureCategory: failure?.category ?? (targetAttemptStatus === "UNKNOWN" ? "UNKNOWN_OUTCOME" : null),
        failureCode: failure?.code ?? (targetAttemptStatus === "UNKNOWN" ? "PROVIDER_OUTCOME_UNKNOWN" : null),
        failureMessage: failure?.operatorMessage ?? (targetAttemptStatus === "UNKNOWN" ? "Provider outcome requires later reconciliation." : null),
        requestSnapshot: requestSnapshot as Prisma.InputJsonValue,
        resultSnapshot: resultSnapshot as Prisma.InputJsonValue,
        completedAt: ["REQUIRES_ACTION", "PROCESSING"].includes(targetAttemptStatus) ? null : now,
        version: { increment: 1 },
      },
    });
    if (attemptUpdate.count !== 1) throw new PaymentError("PAYMENT_CONCURRENCY_CONFLICT", "Payment attempt finalization lost a concurrent update.", true);

    const fromPaymentStatus = payment.status as PaymentState;
    if (fromPaymentStatus !== "PROVIDER_PENDING") {
      throw new PaymentError("PAYMENT_CONCURRENCY_CONFLICT", "Payment is not in the reserved provider state.");
    }
    const historyRows: Array<{
      paymentId: string;
      attemptId: string;
      fromStatus: PaymentState;
      toStatus: PaymentState;
      reasonCode: string;
      actorType: "PROVIDER";
      metadata: { provider: "PAYFAST" };
    }> = [];
    let versionIncrement = 1;
    if (targetPaymentStatus === "SUCCEEDED") {
      assertPaymentTransition(fromPaymentStatus, "PROCESSING");
      assertPaymentTransition("PROCESSING", "SUCCEEDED");
      versionIncrement = 2;
      historyRows.push(
        { paymentId: payment.id, attemptId: attempt.id, fromStatus: fromPaymentStatus, toStatus: "PROCESSING", reasonCode: "PROVIDER_ACCEPTED", actorType: "PROVIDER", metadata: { provider: "PAYFAST" } },
        { paymentId: payment.id, attemptId: attempt.id, fromStatus: "PROCESSING", toStatus: "SUCCEEDED", reasonCode: "PROVIDER_CONFIRMED_SUCCESS", actorType: "PROVIDER", metadata: { provider: "PAYFAST" } },
      );
    } else {
      assertPaymentTransition(fromPaymentStatus, targetPaymentStatus);
      historyRows.push({ paymentId: payment.id, attemptId: attempt.id, fromStatus: fromPaymentStatus, toStatus: targetPaymentStatus, reasonCode: `PROVIDER_${targetAttemptStatus}`, actorType: "PROVIDER", metadata: { provider: "PAYFAST" } });
    }

    const paymentUpdate = await tx.payment.updateMany({
      where: { id: payment.id, version: payment.version, status: payment.status },
      data: {
        status: targetPaymentStatus,
        version: { increment: versionIncrement },
        expiresAt: result?.customerAction?.expiresAt ? new Date(result.customerAction.expiresAt) : null,
        succeededAt: targetPaymentStatus === "SUCCEEDED" ? now : null,
        failedAt: targetPaymentStatus === "FAILED" ? now : null,
        cancelledAt: targetPaymentStatus === "CANCELLED" ? now : null,
      },
    });
    if (paymentUpdate.count !== 1) throw new PaymentError("PAYMENT_CONCURRENCY_CONFLICT", "Payment finalization lost a concurrent update.", true);
    await tx.paymentStatusHistory.createMany({ data: historyRows });

    const finalized = await tx.paymentAttempt.findUnique({ where: { id: attempt.id } });
    if (!finalized) throw new PaymentError("PAYMENT_ATTEMPT_NOT_FOUND", "Finalized payment attempt could not be read.");
    return sessionDto({ paymentId: payment.id, paymentStatus: targetPaymentStatus, attempt: finalized, replayed: false });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      throw new PaymentError("PAYMENT_PROVIDER_REFERENCE_CONFLICT", "Provider reference is already associated with another attempt.");
    }
    throw error;
  }
}

async function callProviderWithTimeout(
  adapter: PaymentProviderAdapter,
  input: ProviderCheckoutSessionInput,
  attemptId: string,
  timeoutMs: number,
): Promise<ProviderCheckoutSessionResult> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      const error = new Error("Provider call timed out.");
      error.name = "AbortError";
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      adapter.createCheckoutSession(input, Object.freeze({ signal: controller.signal, correlationId: attemptId, timeoutMs })),
      timeoutPromise,
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function createProviderCheckoutSession(
  payer: Readonly<{ id: string }>,
  rawInput: CreateProviderSessionInput,
  dependencies: SessionDependencies = {},
): Promise<ProviderSessionDto> {
  const parsed = CreateProviderSessionSchema.safeParse(rawInput);
  if (!parsed.success) throw new PaymentError("PAYMENT_METADATA_INVALID", "Provider-session request is invalid.");

  const callbackUrlFactory = dependencies.callbackUrls ?? buildServerPaymentCallbackUrls;
  const registry = dependencies.registry ?? createProductionPaymentProviderRegistry();
  // Configuration and the Phase 11 production lock are resolved before a
  // reservation so an unavailable provider never consumes an attempt number.
  const adapter = registry.getAdapter(parsed.data.provider);
  let reservation: Awaited<ReturnType<typeof reserveAttempt>>;
  try {
    reservation = await reserveAttempt(payer.id, parsed.data, callbackUrlFactory, adapter);
  } catch (error) {
    if ((error as { code?: string })?.code !== "P2002") throw error;
    reservation = await reserveAttempt(payer.id, parsed.data, callbackUrlFactory, adapter);
  }
  if (reservation.replayed) {
    return sessionDto({
      paymentId: reservation.paymentId,
      paymentStatus: reservation.paymentStatus,
      attempt: reservation.attempt,
      replayed: true,
    });
  }

  const request = providerRequestInput(reservation as ReservedSession);
  await markAttemptRequesting(reservation.attempt.id);
  try {
    const rawResult = await callProviderWithTimeout(
      adapter,
      request,
      reservation.attempt.id,
      Math.min(Math.max(dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS, 100), 30_000),
    );
    return finalizeAttempt(reservation as ReservedSession, request, {
      kind: "result",
      result: validateProviderResult(rawResult, adapter),
    });
  } catch (error) {
    const normalized = error instanceof PaymentError
      ? Object.freeze({
          category: "MALFORMED_RESPONSE" as const,
          code: error.code,
          definitive: false,
          retryMayBeSafe: false,
          configurationFault: false,
          operatorMessage: "Provider response could not be validated; outcome is unknown.",
          customerMessage: "Payment confirmation is still pending.",
        })
      : normalizeProviderError(error);
    return finalizeAttempt(reservation as ReservedSession, request, { kind: "error", error: normalized });
  }
}

/** Phase 11 marketplace entry point; signing and provider calls stay in the existing adapter. */
export async function createMarketplaceProviderCheckoutSession(
  input: Readonly<{ paymentId: string; idempotencyKey: string; payerEmail: string; guestCheckoutEvidence: boolean }>,
  dependencies: SessionDependencies = {},
): Promise<ProviderSessionDto> {
  const callbackUrlFactory = dependencies.callbackUrls ?? buildServerPaymentCallbackUrls;
  const registry = dependencies.registry ?? createProductionPaymentProviderRegistry();
  const adapter = registry.getAdapter("PAYFAST");
  const reservation = await reserveMarketplaceAttempt(input, callbackUrlFactory, adapter);
  if (reservation.replayed) return sessionDto({ paymentId: reservation.paymentId, paymentStatus: reservation.paymentStatus, attempt: reservation.attempt, replayed: true });
  const request = providerRequestInput(reservation);
  await markAttemptRequesting(reservation.attempt.id);
  try {
    const rawResult = await callProviderWithTimeout(adapter, request, reservation.attempt.id, Math.min(Math.max(dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS, 100), 30_000));
    return finalizeAttempt(reservation, request, { kind: "result", result: validateProviderResult(rawResult, adapter) });
  } catch (error) {
    const normalized = error instanceof PaymentError ? Object.freeze({ category: "MALFORMED_RESPONSE" as const, code: error.code, definitive: false, retryMayBeSafe: false, configurationFault: false, operatorMessage: "Provider response could not be validated; outcome is unknown.", customerMessage: "Payment confirmation is still pending." }) : normalizeProviderError(error);
    return finalizeAttempt(reservation, request, { kind: "error", error: normalized });
  }
}
