import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PaymentError } from "@/lib/payments/errors";
import { withPaymentDatabaseRetry } from "@/lib/payments/retry";
import { assertPaymentTransition } from "@/lib/payments/payment-state-machine";
import {
  PaystackClient,
  zarToSubunitCents,
} from "@/lib/payments/providers/paystack/paystack-client";
import { resolvePaystackConfiguration } from "@/lib/payments/providers/paystack/paystack-config";
import { buildPaystackReceiptPosting } from "@/lib/payments/providers/paystack/paystack-ledger-posting-policy";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { activateDepositCashOnDeliveryWithinTransaction } from "@/lib/services/cash-on-delivery.service";
import { confirmVerifiedCourierOrderWithinTransaction } from "@/lib/services/courier-order-confirmation.service";
import {
  openPaymentReconciliationCaseWithinTransaction,
  resolvePaymentReconciliationCasesWithinTransaction,
} from "@/lib/services/payment-reconciliation.service";
import { consumeWalletSpendWithinTransaction } from "@/lib/services/wallet-spending.service";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";
import { isTerminalOrderStatus } from "@/lib/orders/order-state-machine";
import {
  cancelUncollectedCodObligationInTx,
  cancellationRequestHash,
  revokePendingDispatchOffersInTx,
  settlePaidOrderCancellationInTx,
  upsertParcelCancellationResolutionInTx,
} from "@/lib/orders/parcel-cancellation-coordinator.service";
import { applyPaystackWebhookEvent } from "@/lib/services/paystack-webhook-application.service";
import {
  emitAdminAlertNonBlocking,
  recordAdminAlertIntentInTx,
  type AdminAlertEventInput,
} from "@/lib/notifications/admin-alert-dispatch.service";
import { appendCourierPaymentFailedInTx } from "@/lib/services/notification-events.service";
import type { PaymentReconciliationReasonCode, PaymentState } from "@/lib/payments/types";

export type PaystackVerifyRecoveryOutcome =
  | "APPLIED_WEBHOOK"
  | "SETTLED_VIA_VERIFY"
  | "ALREADY_SETTLED"
  | "FAILED_VIA_VERIFY"
  | "PENDING"
  | "RECONCILIATION_REQUIRED"
  | "SKIPPED";

export type PaystackVerifyRecoveryResult = Readonly<{
  recovered: boolean;
  outcome: PaystackVerifyRecoveryOutcome;
  paymentId: string | null;
  paymentReference: string | null;
  attemptId: string | null;
  ledgerJournalReference: string | null;
}>;

const SKIPPED = (
  outcome: PaystackVerifyRecoveryOutcome = "SKIPPED",
  ids: Partial<Pick<PaystackVerifyRecoveryResult, "paymentId" | "paymentReference" | "attemptId">> = {},
): PaystackVerifyRecoveryResult =>
  Object.freeze({
    recovered: false,
    outcome,
    paymentId: ids.paymentId ?? null,
    paymentReference: ids.paymentReference ?? null,
    attemptId: ids.attemptId ?? null,
    ledgerJournalReference: null,
  });

function resolveClient(clientOverride?: PaystackClient): PaystackClient | null {
  if (clientOverride) return clientOverride;
  try {
    const config = resolvePaystackConfiguration();
    if (config.runtime?.secretKey) {
      return new PaystackClient({
        secretKey: config.runtime.secretKey,
        baseUrl: config.runtime.apiBaseUrl,
      });
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Authoritative recovery for Paystack payments when webhook application is
 * delayed or missing. First replays any pending signature-verified webhook; if
 * none exists, queries Paystack Verify API outside locks before posting the
 * canonical receipt and confirming the courier order inside Serializable TX.
 * Never fabricates a webhook signature or trusts browser redirect parameters.
 */
export async function recoverPaystackAttemptViaVerify(input: {
  attemptId: string;
  trigger: string;
  clientOverride?: PaystackClient;
}): Promise<PaystackVerifyRecoveryResult> {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: input.attemptId },
    include: { payment: true },
  });
  if (!attempt || !attempt.payment) return SKIPPED();
  const payment = attempt.payment;

  if (attempt.provider !== "PAYSTACK" || !attempt.merchantReference) {
    return SKIPPED("SKIPPED", {
      paymentId: payment.id,
      paymentReference: payment.publicReference,
      attemptId: attempt.id,
    });
  }

  if (attempt.status === "SUCCEEDED" && payment.status === "SUCCEEDED" && payment.successLedgerJournalId) {
    return Object.freeze({
      recovered: true,
      outcome: "ALREADY_SETTLED",
      paymentId: payment.id,
      paymentReference: payment.publicReference,
      attemptId: attempt.id,
      ledgerJournalReference: null,
    });
  }

  // 1. Prefer applying any pending genuinely signed webhook event for this attempt
  if (typeof prisma.paymentWebhookEvent?.findFirst === "function") {
    const pendingWebhook = await prisma.paymentWebhookEvent.findFirst({
      where: {
        provider: "PAYSTACK",
        merchantReference: attempt.merchantReference,
        signatureVerified: true,
        processingStatus: { in: ["RECEIVED", "TEMPORARY_FAILURE"] },
      },
      orderBy: [{ receivedAt: "desc" }],
      select: { id: true },
    });
    if (pendingWebhook) {
      const applied = await applyPaystackWebhookEvent({
        webhookEventId: pendingWebhook.id,
        clientOverride: input.clientOverride,
      }).catch(() => null);
      if (applied?.outcome === "APPLIED" || applied?.outcome === "DUPLICATE") {
        return Object.freeze({
          recovered: true,
          outcome: "APPLIED_WEBHOOK",
          paymentId: payment.id,
          paymentReference: payment.publicReference,
          attemptId: attempt.id,
          ledgerJournalReference: applied.ledgerJournalReference,
        });
      }
      if (applied?.outcome === "RECONCILIATION_REQUIRED") {
        return SKIPPED("RECONCILIATION_REQUIRED", {
          paymentId: payment.id,
          paymentReference: payment.publicReference,
          attemptId: attempt.id,
        });
      }
    }
  }

  const recoverableStatuses = new Set(["REQUIRES_ACTION", "PROCESSING", "UNKNOWN"]);
  const canVerifyUnsettled =
    recoverableStatuses.has(attempt.status) ||
    (payment.reconciliationStatus === "REQUIRED" && !["CANCELLED", "EXPIRED"].includes(attempt.status));
  if (!canVerifyUnsettled) {
    return SKIPPED("SKIPPED", {
      paymentId: payment.id,
      paymentReference: payment.publicReference,
      attemptId: attempt.id,
    });
  }

  const client = resolveClient(input.clientOverride);
  if (!client) {
    return SKIPPED("SKIPPED", {
      paymentId: payment.id,
      paymentReference: payment.publicReference,
      attemptId: attempt.id,
    });
  }

  // 2. Call Paystack Verify API outside any DB lock
  let verifyData: Awaited<ReturnType<PaystackClient["verifyTransaction"]>>;
  try {
    verifyData = await client.verifyTransaction(attempt.merchantReference);
  } catch {
    return SKIPPED("PENDING", {
      paymentId: payment.id,
      paymentReference: payment.publicReference,
      attemptId: attempt.id,
    });
  }

  const verifyObj = verifyData as unknown as Record<string, unknown>;
  const data =
    verifyObj && typeof verifyObj.data === "object" && verifyObj.data !== null
      ? (verifyObj.data as Record<string, unknown>)
      : verifyObj;
  const verifyStatus = typeof data?.status === "string" ? data.status.toLowerCase() : "unknown";
  const verifyRef = typeof data?.reference === "string" ? data.reference : undefined;
  const verifyCurrency = typeof data?.currency === "string" ? data.currency : undefined;
  const verifyAmount = typeof data?.amount === "number" ? data.amount : undefined;
  const providerIdStr =
    data?.id !== undefined && data?.id !== null
      ? String(data.id)
      : (attempt.providerReference ?? attempt.merchantReference);

  // 3. Handle terminal failure/abandonment reported by Paystack
  if (verifyStatus === "failed" || verifyStatus === "abandoned") {
    const now = new Date();
    const failResult = await withPaymentDatabaseRetry(() =>
      prisma.$transaction(
        async (tx) => {
          if (payment.orderId) {
            await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${payment.orderId} FOR UPDATE`);
          }
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`);
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${attempt.id} FOR UPDATE`);

          const [freshPayment, freshAttempt] = await Promise.all([
            tx.payment.findUnique({ where: { id: payment.id } }),
            tx.paymentAttempt.findUnique({ where: { id: attempt.id } }),
          ]);
          if (
            !freshPayment ||
            !freshAttempt ||
            freshPayment.status === "SUCCEEDED" ||
            freshPayment.successLedgerJournalId ||
            freshAttempt.status === "SUCCEEDED"
          ) {
            return null;
          }
          if (["REQUIRES_ACTION", "PROCESSING", "UNKNOWN"].includes(freshAttempt.status)) {
            await tx.paymentAttempt.update({
              where: { id: freshAttempt.id },
              data: {
                status: "FAILED",
                providerStatusCode: verifyStatus,
                completedAt: now,
                failureCategory: "DECLINED",
                failureCode: `PAYSTACK_${verifyStatus.toUpperCase()}`,
                failureMessage:
                  typeof data?.gateway_response === "string"
                    ? data.gateway_response.slice(0, 200)
                    : `Paystack status: ${verifyStatus}`,
                version: { increment: 1 },
              },
            });
          }
          if (
            freshPayment.latestAttemptNumber === freshAttempt.attemptNumber &&
            ["CREATED", "REQUIRES_ACTION", "PROCESSING", "UNKNOWN"].includes(freshPayment.status)
          ) {
            assertPaymentTransition(freshPayment.status as PaymentState, "FAILED");
            await tx.payment.update({
              where: { id: freshPayment.id },
              data: {
                status: "FAILED",
                failedAt: now,
                version: { increment: 1 },
              },
            });
            const history = await tx.paymentStatusHistory.create({
              data: {
                paymentId: freshPayment.id,
                attemptId: freshAttempt.id,
                fromStatus: freshPayment.status,
                toStatus: "FAILED",
                reasonCode: "PAYSTACK_VERIFY_FAILED",
                actorType: "PROVIDER",
                metadata: { trigger: input.trigger, providerStatus: verifyStatus },
              },
            });
            await tx.notificationEventIntent.upsert({
              where: { operationId: `payment-status-notification:${history.id}` },
              update: {},
              create: {
                sourceAuthority: "PAYMENT",
                eventType: "PAYMENT_STATUS_CHANGED",
                aggregateReference: freshPayment.publicReference,
                operationId: `payment-status-notification:${history.id}`,
                safePayload: {
                  sourceEventId: history.id,
                  paymentReference: freshPayment.publicReference,
                  status: "FAILED",
                },
              },
            });
            if (freshPayment.orderId) {
              const ord = await tx.order.findUnique({
                where: { id: freshPayment.orderId },
                select: { id: true, orderNumber: true },
              });
              if (ord?.orderNumber) {
                await appendCourierPaymentFailedInTx(tx, {
                  orderId: ord.id,
                  orderNumber: ord.orderNumber,
                  historyId: history.id,
                  status: "FAILED",
                });
                await recordAdminAlertIntentInTx(tx, {
                  eventType: "PARCEL_PAYMENT_FAILED",
                  aggregateReference: `parcel-pay-failed:${freshPayment.orderId}:${history.id}`,
                  title: `Parcel payment incomplete (${ord.orderNumber})`,
                  summary: `Paystack Verify reported status ${verifyStatus} for ${freshPayment.publicReference}.`,
                  adminPath: `/admin/orders/${ord.id}`,
                  relatedOrderId: ord.id,
                  metadata: {
                    paymentReference: freshPayment.publicReference,
                    providerStatus: verifyStatus,
                  },
                });
              }
            }
          }
          return true;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    return Object.freeze({
      recovered: !failResult,
      outcome: failResult ? ("FAILED_VIA_VERIFY" as const) : ("ALREADY_SETTLED" as const),
      paymentId: payment.id,
      paymentReference: payment.publicReference,
      attemptId: attempt.id,
      ledgerJournalReference: null,
    });
  }

  if (verifyStatus !== "success") {
    return SKIPPED("PENDING", {
      paymentId: payment.id,
      paymentReference: payment.publicReference,
      attemptId: attempt.id,
    });
  }

  // 4. Verify strict reference, currency, and exact integer subunit amount
  const expectedCents = zarToSubunitCents(attempt.amount.toString());
  const isMerchantMatching = verifyRef === attempt.merchantReference;
  const isCurrencyZar = verifyCurrency === "ZAR";
  const isAmountMatching = verifyAmount === expectedCents;
  const now = new Date();

  if (!isMerchantMatching || !isCurrencyZar || !isAmountMatching) {
    const reason: PaymentReconciliationReasonCode = !isMerchantMatching
      ? "PROVIDER_REFERENCE_CONFLICT"
      : "AMOUNT_MISMATCH";

    await withPaymentDatabaseRetry(() =>
      prisma.$transaction(
        async (tx) => {
          if (payment.orderId) {
            await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${payment.orderId} FOR UPDATE`);
          }
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`);
          await openPaymentReconciliationCaseWithinTransaction(tx, {
            paymentId: payment.id,
            attemptId: attempt.id,
            provider: "PAYSTACK",
            reason,
            safeEvidence: {
              source: "PAYSTACK_VERIFY_API_RECOVERY",
              trigger: input.trigger,
              expectedCents,
              receivedCents: verifyAmount ?? -1,
              verifiedCurrency: verifyCurrency ?? "UNKNOWN",
            },
          });
          await tx.payment.update({
            where: { id: payment.id },
            data: { reconciliationStatus: "REQUIRED" },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    return SKIPPED("RECONCILIATION_REQUIRED", {
      paymentId: payment.id,
      paymentReference: payment.publicReference,
      attemptId: attempt.id,
    });
  }

  // 5. Settle inside Serializable tx using exact canonical ledger + confirmation pipeline
  const txResult = await withPaymentDatabaseRetry(() =>
    prisma.$transaction(
      async (tx) => {
        if (payment.orderId) {
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${payment.orderId} FOR UPDATE`);
        }
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${attempt.id} FOR UPDATE`);

        const [freshPayment, freshAttempt] = await Promise.all([
          tx.payment.findUnique({ where: { id: payment.id } }),
          tx.paymentAttempt.findUnique({ where: { id: attempt.id } }),
        ]);
        if (!freshPayment || !freshAttempt) {
          throw new PaymentError("PAYSTACK_TRANSACTION_NOT_FOUND", "Payment or attempt could not be reloaded.");
        }
        if (freshAttempt.status === "SUCCEEDED" && freshPayment.status === "SUCCEEDED" && freshPayment.successLedgerJournalId) {
          return {
            outcome: "ALREADY_SETTLED" as const,
            ledgerJournalReference: null,
            postCommitAlert: null as AdminAlertEventInput | null,
          };
        }
        if (freshAttempt.status === "CANCELLED" || freshAttempt.status === "EXPIRED") {
          await openPaymentReconciliationCaseWithinTransaction(tx, {
            paymentId: freshPayment.id,
            attemptId: freshAttempt.id,
            provider: "PAYSTACK",
            reason: "OUT_OF_ORDER_EVENT",
            safeEvidence: {
              source: "PAYSTACK_VERIFY_API_RECOVERY",
              trigger: input.trigger,
              attemptStatus: freshAttempt.status,
            },
          });
          await tx.payment.update({
            where: { id: freshPayment.id },
            data: { reconciliationStatus: "REQUIRED" },
          });
          return {
            outcome: "RECONCILIATION_REQUIRED" as const,
            ledgerJournalReference: null,
            postCommitAlert: null as AdminAlertEventInput | null,
          };
        }

        const accounts = await tx.ledgerAccount.findMany({
          where: {
            wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
            code: { in: ["PLATFORM-CASH-CLEARING-ZAR", "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR"] },
            currency: "ZAR",
            status: "ACTIVE",
          },
          select: { id: true, code: true, purpose: true, category: true },
        });
        const cash = accounts.find(
          (a) => a.code === "PLATFORM-CASH-CLEARING-ZAR" && a.purpose === "CASH_CLEARING" && a.category === "ASSET",
        );
        const held = accounts.find(
          (a) => a.code === "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" && a.purpose === "HELD" && a.category === "LIABILITY",
        );
        if (!cash || !held) {
          throw new PaymentError("PAYMENT_PROVIDER_UNAVAILABLE", "Required payment receipt ledger accounts are unavailable.", true);
        }

        const journal = await postLedgerJournalWithinTransaction(
          tx,
          buildPaystackReceiptPosting({
            paymentPublicReference: freshPayment.publicReference,
            attemptPublicReference: freshAttempt.publicReference ?? `attempt-${freshAttempt.attemptNumber}`,
            eventPublicReference: `verify:${freshAttempt.merchantReference ?? freshAttempt.id}`,
            providerPaymentId: providerIdStr,
            amount: freshPayment.amount.toFixed(2),
            cashClearingAccountId: cash.id,
            customerFundsHeldAccountId: held.id,
          }),
        );

        await tx.paymentAttempt.update({
          where: { id: freshAttempt.id },
          data: {
            providerReference: freshAttempt.providerReference?.trim()
              ? freshAttempt.providerReference
              : providerIdStr,
            providerStatusCode: verifyStatus,
            status: "SUCCEEDED",
            providerConfirmedAt: freshAttempt.providerConfirmedAt ?? now,
            completedAt: now,
            failureCategory: null,
            failureCode: null,
            failureMessage: null,
            version: { increment: 1 },
          },
        });

        const existingMeta =
          freshPayment.metadata && typeof freshPayment.metadata === "object" && !Array.isArray(freshPayment.metadata)
            ? (freshPayment.metadata as Record<string, unknown>)
            : {};

        await tx.payment.update({
          where: { id: freshPayment.id },
          data: {
            status: "SUCCEEDED",
            successfulAttemptId: freshAttempt.id,
            successLedgerJournalId: journal.id,
            providerConfirmedAt: freshPayment.providerConfirmedAt ?? now,
            succeededAt: freshPayment.succeededAt ?? now,
            failedAt: null,
            cancelledAt: null,
            reconciliationStatus: "RESOLVED",
            metadata: {
              ...existingMeta,
              verifiedVia: "PAYSTACK_VERIFY_API",
              verifiedTrigger: input.trigger,
            } as Prisma.InputJsonValue,
            version: { increment: 1 },
          },
        });

        const splitWalletAmount =
          typeof existingMeta.walletAmount === "string" ? existingMeta.walletAmount : null;
        let walletReceipt: { amount: string; journalId: string } | null = null;
        if (splitWalletAmount && existingMeta.walletSplit) {
          const ownerType = (existingMeta.walletOwnerType as "CUSTOMER" | "STORE") || "CUSTOMER";
          const ownerId = (existingMeta.walletOwnerId as string) || (freshPayment.userId ?? "");
          walletReceipt = await consumeWalletSpendWithinTransaction(tx, {
            owner: { ownerType, ownerId },
            amount: splitWalletAmount,
            operationId: `paystack:wallet-consume:${freshPayment.publicReference}`,
            subject: {
              subjectType: freshPayment.subjectType as "COURIER_ORDER" | "MARKETPLACE_CHECKOUT",
              subjectId: freshPayment.orderId ?? freshPayment.marketplaceCheckoutId ?? freshPayment.id,
              subjectReference: freshPayment.publicReference,
            },
            fromReserved: true,
            actorUserId: freshPayment.userId ?? undefined,
          });
        }

        await tx.paymentStatusHistory.create({
          data: {
            paymentId: freshPayment.id,
            attemptId: freshAttempt.id,
            fromStatus: freshPayment.status,
            toStatus: "SUCCEEDED",
            reasonCode: "PAYSTACK_VERIFY_API_CONFIRMED",
            actorType: "PROVIDER",
            metadata: {
              trigger: input.trigger,
              providerPaymentId: providerIdStr,
              ledgerJournalReference: journal.reference,
            },
          },
        });

        const lateOrderState = freshPayment.orderId
          ? await tx.order.findUnique({
              where: { id: freshPayment.orderId },
              select: {
                id: true,
                orderNumber: true,
                status: true,
                storeId: true,
                customerId: true,
                parcelCancellationResolution: true,
              },
            })
          : null;

        const hasPendingOrCompletedCancel = Boolean(
          lateOrderState &&
            (lateOrderState.status === "CANCELLED" ||
              lateOrderState.parcelCancellationResolution?.status === "PENDING_PAYMENT_RESOLUTION" ||
              lateOrderState.parcelCancellationResolution?.status?.startsWith("COMPLETED")),
        );

        let postCommitAlert: AdminAlertEventInput | null = null;

        if (hasPendingOrCompletedCancel && lateOrderState) {
          const cancelReason =
            lateOrderState.parcelCancellationResolution?.reason ??
            "Late payment verified after order cancellation request";

          await revokePendingDispatchOffersInTx(tx, {
            orderId: lateOrderState.id,
            actorSystemIdentity: "SYSTEM:PAYSTACK_VERIFY_LATE_CANCELLATION",
            actorRole: "SYSTEM",
            note: cancelReason,
          });
          await cancelUncollectedCodObligationInTx(tx, {
            orderId: lateOrderState.id,
            actorUserId:
              lateOrderState.parcelCancellationResolution?.requestedByUserId ?? freshPayment.userId ?? null,
            reason: cancelReason,
          });
          if (lateOrderState.status !== "CANCELLED" && !isTerminalOrderStatus(lateOrderState.status)) {
            await transitionOrderStatusInTx(tx, {
              orderId: lateOrderState.id,
              fromStatus: lateOrderState.status,
              toStatus: "CANCELLED",
              actorRole: "SYSTEM",
              reason: cancelReason,
              note: "Order cancelled automatically after late payment verification",
              source: "late_verify_cancellation_resolution",
            });
          }

          const settlement = await settlePaidOrderCancellationInTx(tx, {
            orderId: lateOrderState.id,
            orderNumber: lateOrderState.orderNumber,
            storeId: lateOrderState.storeId,
            customerId: lateOrderState.customerId,
            payment: {
              id: freshPayment.id,
              publicReference: freshPayment.publicReference,
              userId: freshPayment.userId,
              provider: freshPayment.provider,
              status: "SUCCEEDED",
              amount: freshPayment.amount,
              totalRefundedAmount: freshPayment.totalRefundedAmount,
              totalRefundReservedAmount: freshPayment.totalRefundReservedAmount,
              version: freshPayment.version + 1,
              metadata: freshPayment.metadata,
              attempts: [],
            },
            reason: cancelReason,
            preferredActorUserId:
              lateOrderState.parcelCancellationResolution?.requestedByUserId ?? freshPayment.userId,
            cancellationActorType: "SYSTEM",
            operationKeyPrefix: "late-verify-cancel",
          });

          await upsertParcelCancellationResolutionInTx(tx, {
            orderId: lateOrderState.id,
            paymentId: freshPayment.id,
            status: "COMPLETED_LATE_PAYMENT_REFUND_INITIATED",
            operationId:
              lateOrderState.parcelCancellationResolution?.operationId ??
              `late-verify-cancel:${lateOrderState.id}:${freshPayment.id}`,
            requestHash:
              lateOrderState.parcelCancellationResolution?.requestHash ??
              cancellationRequestHash({
                orderId: lateOrderState.id,
                requestedByUserId:
                  lateOrderState.parcelCancellationResolution?.requestedByUserId ??
                  freshPayment.userId ??
                  "SYSTEM",
                actorRole: "SYSTEM",
                reason: cancelReason,
              }),
            requestedByUserId:
              lateOrderState.parcelCancellationResolution?.requestedByUserId ??
              freshPayment.userId ??
              lateOrderState.customerId ??
              "SYSTEM",
            actorRole: lateOrderState.parcelCancellationResolution?.actorRole ?? "SYSTEM",
            reason: cancelReason,
            walletOwnerType: settlement.walletOwnerType,
            walletOwnerId: settlement.walletOwnerId,
            walletRefundJournalId: settlement.walletRefundJournalId,
            paymentRefundId: settlement.paymentRefundId,
            decisionEvidence: {
              latePaymentSettledViaVerify: true,
              paymentRefundId: settlement.paymentRefundId,
              walletRefundJournalId: settlement.walletRefundJournalId,
            },
            resolved: true,
          });

          await openPaymentReconciliationCaseWithinTransaction(tx, {
            paymentId: freshPayment.id,
            attemptId: freshAttempt.id,
            reason: "OUT_OF_ORDER_EVENT",
            provider: "PAYSTACK",
            safeEvidence: {
              latePaymentAfterCancelRequest: true,
              source: "PAYSTACK_VERIFY_API_RECOVERY",
              orderId: lateOrderState.id,
            },
          });
        } else {
          await activateDepositCashOnDeliveryWithinTransaction(tx, {
            paymentId: freshPayment.id,
            orderId: freshPayment.orderId,
            amount: freshPayment.amount,
            verifiedEventReference: `verify:${freshAttempt.merchantReference ?? freshAttempt.id}`,
            walletReceipt: walletReceipt ?? undefined,
          });
          await confirmVerifiedCourierOrderWithinTransaction(tx, {
            subjectType: freshPayment.subjectType,
            orderId: freshPayment.orderId,
            publicReference: freshPayment.publicReference,
          });
          await resolvePaymentReconciliationCasesWithinTransaction(
            tx,
            freshPayment.id,
            freshAttempt.id,
            "VERIFIED_COMPLETE",
          );

          if (freshPayment.subjectType === "COURIER_ORDER") {
            postCommitAlert = {
              eventType: "PARCEL_ORDER_PAID",
              aggregateReference: `parcel:${freshPayment.orderId ?? freshPayment.publicReference}`,
              title: `Parcel order paid (${freshPayment.publicReference})`,
              summary: `Paystack Verify API confirmed R${freshPayment.amount.toFixed(2)}.`,
              adminPath: freshPayment.orderId ? `/admin/orders/${freshPayment.orderId}` : "/admin/orders",
              relatedOrderId: freshPayment.orderId ?? undefined,
              metadata: {
                paymentReference: freshPayment.publicReference,
                verifiedVia: "PAYSTACK_VERIFY_API",
                amountZar: freshPayment.amount.toFixed(2),
              },
            };
            await recordAdminAlertIntentInTx(tx, postCommitAlert);
          }
        }

        return {
          outcome: "SETTLED_VIA_VERIFY" as const,
          ledgerJournalReference: journal.reference,
          postCommitAlert,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  if (txResult.outcome === "SETTLED_VIA_VERIFY" && txResult.postCommitAlert) {
    void emitAdminAlertNonBlocking(txResult.postCommitAlert);
  }

  return Object.freeze({
    recovered: txResult.outcome === "SETTLED_VIA_VERIFY" || txResult.outcome === "ALREADY_SETTLED",
    outcome: txResult.outcome,
    paymentId: payment.id,
    paymentReference: payment.publicReference,
    attemptId: attempt.id,
    ledgerJournalReference: txResult.ledgerJournalReference,
  });
}

export async function recoverPendingPaystackPaymentForPaymentId(
  paymentId: string,
  options: { trigger: string; clientOverride?: PaystackClient },
): Promise<PaystackVerifyRecoveryResult> {
  if (typeof prisma.paymentAttempt?.findFirst !== "function") {
    return SKIPPED("SKIPPED", { paymentId });
  }
  const latestAttempt = await prisma.paymentAttempt.findFirst({
    where: {
      paymentId,
      provider: "PAYSTACK",
      status: { in: ["REQUIRES_ACTION", "PROCESSING", "UNKNOWN"] },
    },
    orderBy: [{ attemptNumber: "desc" }],
    select: { id: true },
  });
  if (!latestAttempt) {
    return SKIPPED("SKIPPED", { paymentId });
  }
  return recoverPaystackAttemptViaVerify({
    attemptId: latestAttempt.id,
    trigger: options.trigger,
    clientOverride: options.clientOverride,
  });
}
