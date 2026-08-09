import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PaymentSummaryDto } from "@/lib/dto/payment.dto";
import { PaymentError } from "@/lib/payments/errors";
import { canonicalPaymentHash } from "@/lib/payments/hash";
import { toPaymentSummaryDto } from "@/lib/payments/payment-dto-mappers";
import { PAYMENT_POLICY_VERSION } from "@/lib/payments/types";
import { withPaymentDatabaseRetry } from "@/lib/payments/retry";
import { PrepareOrderPaymentSchema, type PrepareOrderPaymentInput } from "@/lib/validation/payments";
import { resolveOrderPaymentSubject } from "./payment-subject.service";
import { assertPaymentSubjectIntegrity, marketplacePaymentSubject } from "@/lib/payments/payment-subject-policy";

const PAYMENT_SUMMARY_INCLUDE = {
  order: { select: { id: true, orderNumber: true } },
  user: { select: { id: true, name: true } },
} as const;

function newPublicPaymentReference(): string {
  return `pay_${randomBytes(18).toString("base64url")}`;
}

async function replayAfterUniqueRace(
  idempotencyKey: string,
  requestHash: string,
): Promise<PaymentSummaryDto | null> {
  const winner = await prisma.payment.findUnique({
    where: { creationIdempotencyKey: idempotencyKey },
    include: PAYMENT_SUMMARY_INCLUDE,
  });
  if (!winner) return null;
  if (winner.creationRequestHash !== requestHash) {
    throw new PaymentError("PAYMENT_IDEMPOTENCY_CONFLICT", "Payment preparation key was reused for a different request.");
  }
  return toPaymentSummaryDto(winner);
}

export async function prepareOrderPayment(
  payer: Readonly<{ id: string; email?: string }>,
  rawInput: PrepareOrderPaymentInput,
): Promise<PaymentSummaryDto> {
  const parsed = PrepareOrderPaymentSchema.safeParse(rawInput);
  if (!parsed.success) throw new PaymentError("PAYMENT_METADATA_INVALID", "Payment preparation request is invalid.");
  if (!payer.email || payer.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer.email)) {
    throw new PaymentError("PAYFAST_PAYER_EMAIL_REQUIRED", "A valid payer email is required to prepare Payfast checkout.");
  }

  const subject = await resolveOrderPaymentSubject(parsed.data.orderId, payer.id);
  const requestHash = canonicalPaymentHash({
    subjectType: subject.subjectType,
    orderId: subject.subjectId,
    payerId: subject.payerUserId,
    amount: subject.amount.toString(),
    currency: subject.currency,
    policyVersion: PAYMENT_POLICY_VERSION,
  });

  try {
    return await withPaymentDatabaseRetry(() => prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { creationIdempotencyKey: parsed.data.idempotencyKey },
        include: PAYMENT_SUMMARY_INCLUDE,
      });
      if (existing) {
        if (existing.creationRequestHash !== requestHash) {
          throw new PaymentError("PAYMENT_IDEMPOTENCY_CONFLICT", "Payment preparation key was reused for a different request.");
        }
        return toPaymentSummaryDto(existing);
      }

      const existingForOrder = await tx.payment.findUnique({
        where: { orderId: subject.subjectId },
        include: PAYMENT_SUMMARY_INCLUDE,
      });
      if (existingForOrder) {
        throw new PaymentError("PAYMENT_IDEMPOTENCY_CONFLICT", "Order already has a payment under a different preparation key.");
      }

const SUCCEEDED_STATUS = "SUCCEEDED" as const;

      const succeeded = await tx.payment.findFirst({
        where: { orderId: subject.subjectId, status: SUCCEEDED_STATUS },
        select: { id: true },
      });
      if (succeeded) throw new PaymentError("PAYMENT_ORDER_ALREADY_PAID", "Order already has a successful payment.");

      const payment = await tx.payment.create({
        data: {
          publicReference: newPublicPaymentReference(),
          orderId: subject.subjectId,
          userId: subject.payerUserId,
          subjectType: "COURIER_ORDER",
          provider: null,
          purpose: "ORDER",
          status: "CREATED",
          amount: subject.amount.toDecimal(),
          currency: "ZAR",
          creationIdempotencyKey: parsed.data.idempotencyKey,
          creationRequestHash: requestHash,
          version: 0,
          latestAttemptNumber: 0,
          metadata: { subjectType: "ORDER", policyVersion: PAYMENT_POLICY_VERSION },
        },
        include: PAYMENT_SUMMARY_INCLUDE,
      });
      await tx.paymentStatusHistory.create({
        data: {
          paymentId: payment.id,
          fromStatus: null,
          toStatus: "CREATED",
          reasonCode: "PAYMENT_PREPARED",
          actorType: "PAYER",
          actorId: payer.id,
          metadata: { policyVersion: PAYMENT_POLICY_VERSION },
        },
      });
      return toPaymentSummaryDto(payment);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replay = await replayAfterUniqueRace(parsed.data.idempotencyKey, requestHash);
      if (replay) return replay;
      const orderWinner = await prisma.payment.findUnique({
        where: { orderId: subject.subjectId },
        include: PAYMENT_SUMMARY_INCLUDE,
      });
      if (orderWinner) throw new PaymentError("PAYMENT_IDEMPOTENCY_CONFLICT", "Order already has a payment under a different preparation key.");
    }
    throw error;
  }
}

export type MarketplacePaymentPreparationCommand = Readonly<{
  checkoutId: string;
  checkoutReference: string;
  amount: string;
  currency: "ZAR";
  commercialFingerprint: string;
  payerEmail: string;
  customerUserId?: string | null;
  guestAccessTokenHash?: string | null;
  operationId: string;
}>;

export async function prepareMarketplacePayment(command: MarketplacePaymentPreparationCommand): Promise<MarketplacePreparedPayment> {
  return prepareMarketplaceCheckoutPayment(
    {
      checkoutId: command.checkoutId,
      checkoutReference: command.checkoutReference,
      amount: command.amount,
      currency: command.currency,
      commercialFingerprint: command.commercialFingerprint,
      operationId: command.operationId,
    },
    {
      subjectType: "MARKETPLACE_CHECKOUT",
      subjectId: command.checkoutId,
      customerUserId: command.customerUserId,
      guestAccessTokenHash: command.guestAccessTokenHash,
    },
  );
}


/**
 * Phase 10 marketplace entry point. It reuses the Payment aggregate,
 * idempotency and history policy while deliberately omitting Order creation.
 */
export type MarketplacePreparedPayment = Readonly<{ id: string; publicReference: string; amount: string; currency: "ZAR"; replayed: boolean }>;

export async function prepareMarketplaceCheckoutPayment(
  command: Readonly<{
    checkoutId: string;
    checkoutReference: string;
    amount: string;
    currency: "ZAR";
    commercialFingerprint: string;
    operationId: string;
  }>,
  subject: Readonly<{
    subjectType: "MARKETPLACE_CHECKOUT";
    subjectId: string;
    customerUserId?: string | null;
    guestAccessTokenHash?: string | null;
  }>,
): Promise<MarketplacePreparedPayment> {
  const paymentSubject = marketplacePaymentSubject({
    checkoutId: command.checkoutId,
    customerUserId: subject.customerUserId ?? null,
    guestAccessTokenHash: subject.guestAccessTokenHash ?? null,
  });
  const requestHash = canonicalPaymentHash({
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    amount: command.amount,
    currency: command.currency,
    commercialFingerprint: command.commercialFingerprint,
    policyVersion: PAYMENT_POLICY_VERSION,
  });
  return withPaymentDatabaseRetry(() => prisma.$transaction(async (tx) => {
    const checkout = await tx.marketplaceCheckout.findUnique({ where: { id: command.checkoutId }, select: { id: true, publicReference: true, customerUserId: true, guestAccessTokenHash: true, acceptedFingerprint: true, grandTotal: true, currency: true } });
    if (!checkout || checkout.publicReference !== command.checkoutReference || checkout.acceptedFingerprint !== command.commercialFingerprint || checkout.currency !== "ZAR" || checkout.grandTotal.toFixed(2) !== command.amount) {
      throw new PaymentError("PAYMENT_METADATA_INVALID", "Marketplace checkout evidence changed before payment preparation.");
    }
    assertPaymentSubjectIntegrity({
      ...paymentSubject,
      checkoutCustomerUserId: checkout.customerUserId,
      checkoutGuestAccessTokenHash: checkout.guestAccessTokenHash,
    });
    const existing = await tx.payment.findUnique({ where: { creationIdempotencyKey: command.operationId } });
    if (existing) {
      if (existing.creationRequestHash !== requestHash) throw new PaymentError("PAYMENT_IDEMPOTENCY_CONFLICT", "Payment preparation key was reused for different marketplace evidence.");
      return Object.freeze({ id: existing.id, publicReference: existing.publicReference, amount: existing.amount.toFixed(2), currency: "ZAR" as const, replayed: true });
    }
    const existingCheckoutPayment = await tx.payment.findUnique({ where: { marketplaceCheckoutId: command.checkoutId } });
    if (existingCheckoutPayment) throw new PaymentError("PAYMENT_IDEMPOTENCY_CONFLICT", "Marketplace checkout already has a payment under a different operation.");
    const payment = await tx.payment.create({ data: {
      publicReference: newPublicPaymentReference(), subjectType: "MARKETPLACE_CHECKOUT", marketplaceCheckoutId: command.checkoutId,
      orderId: null, userId: subject.customerUserId ?? null, provider: null, purpose: "ORDER", status: "CREATED",
      amount: new Prisma.Decimal(command.amount), currency: "ZAR", creationIdempotencyKey: command.operationId,
      creationRequestHash: requestHash, version: 0, latestAttemptNumber: 0,
      metadata: { subjectType: "MARKETPLACE_CHECKOUT", checkoutReference: command.checkoutReference, commercialFingerprint: command.commercialFingerprint, policyVersion: PAYMENT_POLICY_VERSION },
    } });
    await tx.paymentStatusHistory.create({ data: { paymentId: payment.id, fromStatus: null, toStatus: "CREATED", reasonCode: "MARKETPLACE_PAYMENT_PREPARED", actorType: subject.customerUserId ? "PAYER" : "SYSTEM", actorId: subject.customerUserId ?? null, metadata: { checkoutReference: command.checkoutReference, commercialFingerprint: command.commercialFingerprint } } });
    return Object.freeze({ id: payment.id, publicReference: payment.publicReference, amount: payment.amount.toFixed(2), currency: "ZAR" as const, replayed: false });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}
