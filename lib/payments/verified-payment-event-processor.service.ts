/* eslint-disable @typescript-eslint/no-explicit-any -- the additive Phase 4 outbox is intentionally not generated before migration approval. */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { onVerifiedMarketplacePaymentSucceededInProduction } from "@/lib/marketplace-checkout/marketplace-payment-success-hook.service";
import { onVerifiedSubscriptionPaymentSucceededInProduction } from "@/lib/subscriptions/subscription-payment-success-hook.service";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { openPaymentReconciliationCaseWithinTransaction } from "@/lib/services/payment-reconciliation.service";
import { VERIFIED_PAYMENT_EVENT_TYPE } from "@/lib/services/payfast-itn-application.service";

export const VERIFIED_PAYMENT_EVENT_CONSUMER = "PAYMENT_SUCCESS_DISPATCH_V1" as const;
const PROCESSING_LEASE_MS = 5 * 60_000;

export type VerifiedPaymentEvent = Readonly<{
  id: string;
  publicReference: string;
  eventIdentity: string;
  paymentId: string;
  successfulAttemptId: string;
  webhookEventId: string;
  subjectType: "COURIER_ORDER" | "MARKETPLACE_CHECKOUT" | "SUBSCRIPTION_INVOICE" | "MANAGED_MARKETING_REQUEST";
}>;

type EventClaim = Readonly<{ kind: "CLAIMED"; receiptId: string } | { kind: "SKIPPED" }>;

export type VerifiedPaymentEventRepository = Readonly<{
  claim(event: VerifiedPaymentEvent): Promise<EventClaim>;
  complete(receiptId: string): Promise<void>;
  reconcile(event: VerifiedPaymentEvent, receiptId: string, errorCode: string): Promise<void>;
}>;

export type VerifiedPaymentEventEffects = Readonly<{
  finalizeMarketplacePayment(paymentId: string): Promise<void>;
  activateSubscriptionPayment(paymentId: string): Promise<void>;
  recognizeManagedMarketingRevenue(paymentId: string): Promise<unknown>;
}>;

export type VerifiedPaymentEventConsumeOutcome = "MARKETPLACE_FINALIZED" | "SUBSCRIPTION_ACTIVATED" | "MANAGED_MARKETING_RECOGNIZED" | "NO_DOWNSTREAM_EFFECT" | "SKIPPED" | "RECONCILIATION_REQUIRED";

function safeErrorCode(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "PAYMENT_VERIFIED_EVENT_DISPATCH_FAILED";
  return /^[A-Z0-9_]{3,120}$/.test(code) ? code : "PAYMENT_VERIFIED_EVENT_DISPATCH_FAILED";
}

/**
 * The only downstream dispatcher for PAYMENT_SUCCEEDED_VERIFIED. The claim is
 * durable, but all business effects remain in their existing canonical
 * services and are independently idempotent.
 */
export async function consumeVerifiedPaymentEvent(
  repository: VerifiedPaymentEventRepository,
  effects: VerifiedPaymentEventEffects,
  event: VerifiedPaymentEvent,
): Promise<VerifiedPaymentEventConsumeOutcome> {
  const claim = await repository.claim(event);
  if (claim.kind === "SKIPPED") return "SKIPPED";
  try {
    let outcome: Exclude<VerifiedPaymentEventConsumeOutcome, "SKIPPED" | "RECONCILIATION_REQUIRED">;
    if (event.subjectType === "MARKETPLACE_CHECKOUT") {
      await effects.finalizeMarketplacePayment(event.paymentId);
      outcome = "MARKETPLACE_FINALIZED";
    } else if (event.subjectType === "SUBSCRIPTION_INVOICE") {
      await effects.activateSubscriptionPayment(event.paymentId);
      outcome = "SUBSCRIPTION_ACTIVATED";
    } else if (event.subjectType === "MANAGED_MARKETING_REQUEST") {
      await effects.recognizeManagedMarketingRevenue(event.paymentId);
      outcome = "MANAGED_MARKETING_RECOGNIZED";
    } else {
      outcome = "NO_DOWNSTREAM_EFFECT";
    }
    await repository.complete(claim.receiptId);
    return outcome;
  } catch (error) {
    await repository.reconcile(event, claim.receiptId, safeErrorCode(error));
    return "RECONCILIATION_REQUIRED";
  }
}

function operationId(event: VerifiedPaymentEvent): string {
  return `payment-verified-dispatch:${event.eventIdentity}`;
}

export function createPrismaVerifiedPaymentEventRepository(database: any = prisma): VerifiedPaymentEventRepository & { listCandidates(limit: number, subjectTypes?: readonly VerifiedPaymentEvent["subjectType"][]): Promise<VerifiedPaymentEvent[]> } {
  return Object.freeze({
    async listCandidates(limit, subjectTypes) {
      const bounded = Math.max(1, Math.min(limit, 500));
      return database.paymentVerifiedEventIntent.findMany({
        where: {
          eventType: VERIFIED_PAYMENT_EVENT_TYPE,
          ...(subjectTypes?.length ? { subjectType: { in: subjectTypes } } : {}),
          deliveries: { none: { consumer: VERIFIED_PAYMENT_EVENT_CONSUMER, status: { in: ["COMPLETED", "RECONCILIATION_REQUIRED"] } } },
        },
        select: { id: true, publicReference: true, eventIdentity: true, paymentId: true, successfulAttemptId: true, webhookEventId: true, subjectType: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: bounded,
      });
    },
    async claim(event) {
      const now = new Date();
      try {
        return await database.$transaction(async (tx: any) => {
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentVerifiedEventIntent" WHERE "id" = ${event.id} FOR UPDATE`);
          const receipt = await tx.paymentVerifiedEventConsumerReceipt.findUnique({ where: { eventIntentId_consumer: { eventIntentId: event.id, consumer: VERIFIED_PAYMENT_EVENT_CONSUMER } } });
          if (receipt?.status === "COMPLETED" || receipt?.status === "RECONCILIATION_REQUIRED") return { kind: "SKIPPED" as const };
          if (receipt?.status === "PROCESSING" && receipt.updatedAt.getTime() > now.getTime() - PROCESSING_LEASE_MS) return { kind: "SKIPPED" as const };
          if (receipt) {
            const updated = await tx.paymentVerifiedEventConsumerReceipt.update({
              where: { id: receipt.id },
              data: { status: "PROCESSING", attemptCount: { increment: 1 }, lastErrorCode: null, startedAt: now, completedAt: null },
            });
            return { kind: "CLAIMED" as const, receiptId: updated.id };
          }
          const created = await tx.paymentVerifiedEventConsumerReceipt.create({
            data: { eventIntentId: event.id, consumer: VERIFIED_PAYMENT_EVENT_CONSUMER, operationId: operationId(event), status: "PROCESSING", attemptCount: 1, startedAt: now },
          });
          return { kind: "CLAIMED" as const, receiptId: created.id };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if ((error as { code?: string }).code !== "P2002") throw error;
        return { kind: "SKIPPED" as const };
      }
    },
    async complete(receiptId) {
      await database.paymentVerifiedEventConsumerReceipt.update({
        where: { id: receiptId },
        data: { status: "COMPLETED", lastErrorCode: null, completedAt: new Date() },
      });
    },
    async reconcile(event, receiptId, errorCode) {
      await database.$transaction(async (tx: any) => {
        await tx.paymentVerifiedEventConsumerReceipt.update({
          where: { id: receiptId },
          data: { status: "RECONCILIATION_REQUIRED", lastErrorCode: errorCode, completedAt: new Date() },
        });
        await openPaymentReconciliationCaseWithinTransaction(tx, {
          paymentId: event.paymentId,
          attemptId: event.successfulAttemptId,
          webhookEventId: event.webhookEventId,
          reason: "APPLICATION_FAILURE_AFTER_VERIFICATION",
          safeEvidence: { verifiedPaymentEventReference: event.publicReference, dispatchErrorCode: errorCode },
        });
        await tx.payment.update({ where: { id: event.paymentId }, data: { reconciliationStatus: "REQUIRED" } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
  });
}

export async function consumeVerifiedPaymentEvents(input: Readonly<{ limit: number; subjectTypes?: readonly VerifiedPaymentEvent["subjectType"][] }>): Promise<Readonly<Record<VerifiedPaymentEventConsumeOutcome, number>>> {
  const repository = createPrismaVerifiedPaymentEventRepository();
  const events = await repository.listCandidates(input.limit, input.subjectTypes);
  const outcomes: Record<VerifiedPaymentEventConsumeOutcome, number> = {
    MARKETPLACE_FINALIZED: 0,
    SUBSCRIPTION_ACTIVATED: 0,
    MANAGED_MARKETING_RECOGNIZED: 0,
    NO_DOWNSTREAM_EFFECT: 0,
    SKIPPED: 0,
    RECONCILIATION_REQUIRED: 0,
  };
  const effects: VerifiedPaymentEventEffects = {
    finalizeMarketplacePayment: onVerifiedMarketplacePaymentSucceededInProduction,
    activateSubscriptionPayment: onVerifiedSubscriptionPaymentSucceededInProduction,
    recognizeManagedMarketingRevenue: (paymentId) => new ManagedMarketingService().recognizeVerifiedPayment(paymentId),
  };
  for (const event of events) outcomes[await consumeVerifiedPaymentEvent(repository, effects, event)] += 1;
  return Object.freeze(outcomes);
}
