import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import { withPaymentDatabaseRetry } from "@/lib/payments/retry";
import { getCourierPaymentReadiness } from "@/lib/services/courier-payment-readiness.service";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";
import {
  cancelUncollectedCodObligationInTx,
  cancellationRequestHash,
  revokePendingDispatchOffersInTx,
  upsertParcelCancellationResolutionInTx,
} from "@/lib/orders/parcel-cancellation-coordinator.service";
import { releaseParcelOrderWalletReservationWithinTransaction } from "@/lib/services/wallet-spending.service";
import { recoverPendingPaystackPaymentForPaymentId } from "@/lib/services/paystack-verify-recovery.service";
import { appendCourierUnpaidCancelledInTx } from "@/lib/services/notification-events.service";
import {
  emitAdminAlertNonBlocking,
  recordAdminAlertIntentInTx,
  type AdminAlertEventInput,
} from "@/lib/notifications/admin-alert-dispatch.service";
import { OrderOperationalEventType, OrderStatus } from "@/types/db";

export const UNPAID_PARCEL_EXPIRY_REASON_CODE = "PAYMENT_DEADLINE_EXPIRED" as const;

export const UNPAID_PARCEL_EXPIRY_ELIGIBLE_WHERE = (now: Date): Prisma.OrderWhereInput => ({
  status: OrderStatus.PENDING,
  paymentDueAt: { lte: now },
  marketplaceStoreOrderBridge: { is: null },
  custodyEstablishedAt: null,
  OR: [
    { cashOnDelivery: { is: null } },
    { cashOnDelivery: { policyMode: { not: "FULL_COD" } } },
  ],
});

export type ExpireUnpaidCourierOrdersResult = Readonly<{
  itemsExamined: number;
  itemsClaimed: number;
  itemsCompleted: number;
  itemsSkipped: number;
  itemsRetried: number;
  itemsReconciled: number;
  expiredOrderIds: readonly string[];
  safeSummary: string;
}>;

export async function expireUnpaidCourierOrdersBatch(options?: {
  mode?: "DRY_RUN" | "APPLY";
  batchSize?: number;
  now?: Date;
  clientOverride?: PaystackClient;
}): Promise<ExpireUnpaidCourierOrdersResult> {
  const mode = options?.mode ?? "APPLY";
  const batchSize = Math.min(Math.max(options?.batchSize ?? 50, 1), 500);
  const now = options?.now ?? new Date();

  const candidates = await prisma.order.findMany({
    where: UNPAID_PARCEL_EXPIRY_ELIGIBLE_WHERE(now),
    select: {
      id: true,
      orderNumber: true,
      paymentDueAt: true,
      payments: {
        where: { subjectType: "COURIER_ORDER" },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          status: true,
          reconciliationStatus: true,
          attempts: {
            where: { status: { in: ["REQUIRES_ACTION", "PROCESSING", "UNKNOWN"] } },
            select: { id: true, status: true },
          },
        },
      },
    },
    orderBy: [{ paymentDueAt: "asc" }, { id: "asc" }],
    take: batchSize,
  });

  const itemsExamined = candidates.length;
  if (mode === "DRY_RUN") {
    return Object.freeze({
      itemsExamined,
      itemsClaimed: 0,
      itemsCompleted: 0,
      itemsSkipped: itemsExamined,
      itemsRetried: 0,
      itemsReconciled: 0,
      expiredOrderIds: [],
      safeSummary: `[DRY_RUN] Evaluated ${itemsExamined} overdue unpaid courier orders; 0 cancelled.`,
    });
  }

  let itemsCompleted = 0;
  let itemsSkipped = 0;
  let itemsRetried = 0;
  let itemsReconciled = 0;
  const expiredOrderIds: string[] = [];

  for (const candidate of candidates) {
    const latestPayment = candidate.payments[0] ?? null;

    // 1. Bounded external Paystack Verify recovery strictly OUTSIDE any DB row lock
    let externalOutcome: string | null = null;
    if (latestPayment && (latestPayment.attempts.length > 0 || ["CREATED", "REQUIRES_ACTION", "PROCESSING"].includes(latestPayment.status))) {
      const recovery = await recoverPendingPaystackPaymentForPaymentId(latestPayment.id, {
        trigger: "expire_unpaid_preflight",
        clientOverride: options?.clientOverride,
      }).catch(() => null);
      externalOutcome = recovery?.outcome ?? null;
      if (recovery?.recovered) {
        itemsSkipped += 1;
        continue;
      }
      if (recovery?.outcome === "RECONCILIATION_REQUIRED") {
        itemsReconciled += 1;
        continue;
      }
    }

    // 2. Authoritative atomic expiry inside Serializable transaction
    let outcome: {
      kind: "EXPIRED" | "SKIPPED" | "RECONCILED" | "RETRIED";
      alert?: AdminAlertEventInput | null;
    };
    try {
      outcome = await withPaymentDatabaseRetry(() =>
        prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${candidate.id} FOR UPDATE`);

            const order = await tx.order.findUnique({
              where: { id: candidate.id },
              include: {
                cashOnDelivery: true,
                marketplaceStoreOrderBridge: { select: { id: true } },
                parcelCancellationResolution: { select: { id: true, status: true } },
                assignments: {
                  where: { status: { in: ["ASSIGNED", "ACCEPTED"] } },
                  select: { id: true, status: true },
                },
                payments: {
                  where: { subjectType: "COURIER_ORDER" },
                  orderBy: [{ createdAt: "desc" }],
                  take: 1,
                  include: {
                    attempts: { select: { id: true, status: true, expiresAt: true } },
                  },
                },
              },
            });

            if (
              !order ||
              order.status !== OrderStatus.PENDING ||
              !order.paymentDueAt ||
              order.paymentDueAt > now ||
              order.marketplaceStoreOrderBridge ||
              order.custodyEstablishedAt ||
              order.cashOnDelivery?.policyMode === "FULL_COD"
            ) {
              return { kind: "SKIPPED" as const };
            }

            if (order.assignments.some((a) => a.status === "ACCEPTED")) {
              return { kind: "SKIPPED" as const };
            }

            const readiness = await getCourierPaymentReadiness(order.id, tx);
            const payment = order.payments[0] ?? null;

            if (
              readiness.dispatchEligible ||
              readiness.status === "PAID" ||
              readiness.status === "DEPOSIT_PAID_CASH_DUE" ||
              payment?.status === "SUCCEEDED" ||
              Boolean(payment?.successLedgerJournalId)
            ) {
              return { kind: "SKIPPED" as const };
            }

            if (
              readiness.status === "RECONCILIATION_REQUIRED" ||
              payment?.reconciliationStatus === "REQUIRED"
            ) {
              return { kind: "RECONCILED" as const };
            }

            const hasAmbiguousAttempt = Boolean(
              payment?.attempts.some(
                (a) =>
                  a.status === "PROCESSING" ||
                  a.status === "UNKNOWN" ||
                  (a.status === "REQUIRES_ACTION" && externalOutcome === "PENDING" && (!a.expiresAt || a.expiresAt > now)),
              ),
            );
            if (hasAmbiguousAttempt) {
              return { kind: "RETRIED" as const };
            }

            const expiryReason =
              "Order automatically cancelled because required payment was not verified within the 24-hour payment deadline.";

            await revokePendingDispatchOffersInTx(tx, {
              orderId: order.id,
              actorSystemIdentity: "SYSTEM:EXPIRE_UNPAID_COURIER_ORDERS",
              actorRole: "SYSTEM",
              note: expiryReason,
            });

            if (order.cashOnDelivery) {
              await cancelUncollectedCodObligationInTx(tx, {
                orderId: order.id,
                actorUserId: null,
                reason: expiryReason,
              });
            }

            const paymentMeta =
              payment?.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
                ? (payment.metadata as Record<string, unknown>)
                : {};
            let releasedWalletJournalId: string | null = null;
            if (payment && paymentMeta.walletSplit === true && typeof paymentMeta.walletAmount === "string") {
              // Ensure stale REQUIRES_ACTION attempt won't block split-wallet release if verify saw failed/expired or no attempt ambiguity
              await tx.paymentAttempt.updateMany({
                where: {
                  paymentId: payment.id,
                  status: "REQUIRES_ACTION",
                },
                data: {
                  status: "EXPIRED",
                  completedAt: now,
                  failureCode: UNPAID_PARCEL_EXPIRY_REASON_CODE,
                  failureMessage: expiryReason,
                  version: { increment: 1 },
                },
              });
              if (["REQUIRES_ACTION", "PROCESSING", "PROVIDER_PENDING"].includes(payment.status)) {
                await tx.payment.update({
                  where: { id: payment.id },
                  data: { status: "EXPIRED", version: { increment: 1 } },
                });
              }
              const released = await releaseParcelOrderWalletReservationWithinTransaction(tx, {
                orderId: order.id,
                reason: expiryReason,
              });
              releasedWalletJournalId = released.journalId;
            } else if (payment && ["CREATED", "REQUIRES_ACTION", "FAILED"].includes(payment.status)) {
              await tx.paymentAttempt.updateMany({
                where: { paymentId: payment.id, status: "REQUIRES_ACTION" },
                data: {
                  status: "EXPIRED",
                  completedAt: now,
                  failureCode: UNPAID_PARCEL_EXPIRY_REASON_CODE,
                  failureMessage: expiryReason,
                  version: { increment: 1 },
                },
              });
              if (payment.status !== "CANCELLED") {
                await tx.payment.update({
                  where: { id: payment.id },
                  data: {
                    status: "EXPIRED",
                    version: { increment: 1 },
                  },
                });
                await tx.paymentStatusHistory.create({
                  data: {
                    paymentId: payment.id,
                    fromStatus: payment.status,
                    toStatus: "EXPIRED",
                    reasonCode: UNPAID_PARCEL_EXPIRY_REASON_CODE,
                    actorType: "SYSTEM",
                    metadata: { paymentDueAt: order.paymentDueAt.toISOString() },
                  },
                });
              }
            }

            await transitionOrderStatusInTx(tx, {
              orderId: order.id,
              fromStatus: OrderStatus.PENDING,
              toStatus: OrderStatus.CANCELLED,
              actorRole: "SYSTEM",
              reason: expiryReason,
              note: expiryReason,
              source: "expire_unpaid_courier_orders",
              context: { reason: expiryReason },
              audit: {
                eventType: OrderOperationalEventType.ADMIN_OPERATION_NOTE_ADDED,
                publicNote: expiryReason,
                internalNote: `${UNPAID_PARCEL_EXPIRY_REASON_CODE} (${order.paymentDueAt.toISOString()})`,
                metadata: {
                  reasonCode: UNPAID_PARCEL_EXPIRY_REASON_CODE,
                  paymentDueAt: order.paymentDueAt.toISOString(),
                },
              },
            });

            if (!order.parcelCancellationResolution) {
              const opId = `parcel-unpaid-expiry:${order.id}:${order.paymentDueAt.toISOString()}`;
              await upsertParcelCancellationResolutionInTx(tx, {
                orderId: order.id,
                paymentId: payment?.id ?? null,
                status: "COMPLETED_UNPAID_CANCELLED",
                operationId: opId,
                requestHash: cancellationRequestHash({
                  orderId: order.id,
                  requestedByUserId: "SYSTEM",
                  actorRole: "SYSTEM",
                  reason: UNPAID_PARCEL_EXPIRY_REASON_CODE,
                }),
                requestedByUserId: order.customerId ?? "SYSTEM",
                actorRole: "SYSTEM",
                reason: expiryReason,
                walletRefundJournalId: releasedWalletJournalId,
                decisionEvidence: {
                  reasonCode: UNPAID_PARCEL_EXPIRY_REASON_CODE,
                  paymentDueAt: order.paymentDueAt.toISOString(),
                  expiredAt: now.toISOString(),
                },
                resolved: true,
              });
            }

            await appendCourierUnpaidCancelledInTx(tx, {
              id: order.id,
              orderNumber: order.orderNumber,
              reasonCode: UNPAID_PARCEL_EXPIRY_REASON_CODE,
            });

            const alert: AdminAlertEventInput = {
              eventType: "PARCEL_ORDER_UNPAID_EXPIRED",
              aggregateReference: `parcel-expiry:${order.id}`,
              title: `Unpaid parcel cancelled after 24h (${order.orderNumber})`,
              summary: `Deadline ${order.paymentDueAt.toISOString()} passed without verified ledger payment.`,
              adminPath: `/admin/orders/${order.id}`,
              relatedOrderId: order.id,
              metadata: {
                orderNumber: order.orderNumber,
                reasonCode: UNPAID_PARCEL_EXPIRY_REASON_CODE,
                paymentDueAt: order.paymentDueAt.toISOString(),
              },
            };
            await recordAdminAlertIntentInTx(tx, alert);

            return { kind: "EXPIRED" as const, alert };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    } catch {
      outcome = { kind: "RETRIED" };
    }

    if (outcome.kind === "EXPIRED") {
      itemsCompleted += 1;
      expiredOrderIds.push(candidate.id);
      if (outcome.alert) {
        void emitAdminAlertNonBlocking(outcome.alert);
      }
    } else if (outcome.kind === "RECONCILED") {
      itemsReconciled += 1;
    } else if (outcome.kind === "RETRIED") {
      itemsRetried += 1;
    } else {
      itemsSkipped += 1;
    }
  }

  return Object.freeze({
    itemsExamined,
    itemsClaimed: itemsCompleted + itemsReconciled,
    itemsCompleted,
    itemsSkipped,
    itemsRetried,
    itemsReconciled,
    expiredOrderIds,
    safeSummary: `Evaluated ${itemsExamined} overdue unpaid parcel orders: ${itemsCompleted} expired/cancelled, ${itemsReconciled} reconciliation-held, ${itemsSkipped} skipped, ${itemsRetried} deferred.`,
  });
}
