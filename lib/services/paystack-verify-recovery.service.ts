import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PaymentError } from "@/lib/payments/errors";
import { withPaymentDatabaseRetry } from "@/lib/payments/retry";
import { assertPaymentTransition, canTransitionPayment } from "@/lib/payments/payment-state-machine";
import {
  PaystackClient,
  sanitizePaystackErrorMessage,
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
import { describeCourierOrderPaymentSplitFromDb } from "@/lib/services/courier-payment-split-summary";
import type { PaymentReconciliationReasonCode, PaymentState } from "@/lib/payments/types";
import { createQaPaystackClient } from "@/lib/qa-acceptance/config";
import { ensureQaPlatformSandboxAccountsInTx } from "@/lib/qa-acceptance/ledger";
import { onVerifiedMarketplacePaymentSucceededInProduction } from "@/lib/marketplace-checkout/marketplace-payment-success-hook.service";

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

function resolveClient(clientOverride?: PaystackClient, isQaAcceptance?: boolean): PaystackClient | null {
  if (clientOverride) return clientOverride;
  if (isQaAcceptance) {
    try {
      return createQaPaystackClient();
    } catch {
      return null;
    }
  }
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

const ACTIVE_PENDING_VERIFY_STATUSES = new Set(["ongoing", "pending", "queued", "processing"]);
const STALE_RECOVERABLE_ATTEMPT_STATUSES = new Set(["RESERVED", "REQUESTING"]);
const STALE_NOT_FOUND_ELIGIBLE_STATUSES = new Set(["UNKNOWN", "RESERVED", "REQUESTING"]);
const FAILURE_UPDATABLE_ATTEMPT_STATUSES = new Set([
  "RESERVED",
  "REQUESTING",
  "REQUIRES_ACTION",
  "PROCESSING",
  "UNKNOWN",
]);

async function openPaystackReconciliationRequiredInTx(input: {
  paymentId: string;
  orderId: string | null;
  attemptId: string;
  reason: PaymentReconciliationReasonCode;
  safeEvidence: Readonly<Record<string, string | number | boolean | null>>;
}): Promise<void> {
  await withPaymentDatabaseRetry(() =>
    prisma.$transaction(
      async (tx) => {
        if (input.orderId) {
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`);
        }
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${input.paymentId} FOR UPDATE`);
        await openPaymentReconciliationCaseWithinTransaction(tx, {
          paymentId: input.paymentId,
          attemptId: input.attemptId,
          provider: "PAYSTACK",
          reason: input.reason,
          safeEvidence: input.safeEvidence,
        });
        await tx.payment.update({
          where: { id: input.paymentId },
          data: { reconciliationStatus: "REQUIRED" },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

async function recordPaystackAttemptFailureViaVerify(input: {
  paymentId: string;
  paymentPublicReference: string;
  orderId: string | null;
  attemptId: string;
  trigger: string;
  providerStatus: string;
  failureCategory: "DECLINED" | "MALFORMED_RESPONSE" | "UNKNOWN_OUTCOME";
  failureCode: string;
  failureMessage: string;
  historyReasonCode: string;
}): Promise<PaystackVerifyRecoveryResult> {
  const now = new Date();
  const failResult = await withPaymentDatabaseRetry(() =>
    prisma.$transaction(
      async (tx) => {
        if (input.orderId) {
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`);
        }
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${input.paymentId} FOR UPDATE`);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${input.attemptId} FOR UPDATE`);

        const [freshPayment, freshAttempt] = await Promise.all([
          tx.payment.findUnique({ where: { id: input.paymentId } }),
          tx.paymentAttempt.findUnique({ where: { id: input.attemptId } }),
        ]);
        if (
          !freshPayment ||
          !freshAttempt ||
          freshPayment.status === "SUCCEEDED" ||
          freshPayment.successLedgerJournalId ||
          freshAttempt.status === "SUCCEEDED"
        ) {
          return "ALREADY_SETTLED" as const;
        }
        if (FAILURE_UPDATABLE_ATTEMPT_STATUSES.has(freshAttempt.status)) {
          await tx.paymentAttempt.update({
            where: { id: freshAttempt.id },
            data: {
              status: "FAILED",
              providerStatusCode: input.providerStatus,
              completedAt: now,
              failureCategory: input.failureCategory,
              failureCode: input.failureCode,
              failureMessage: sanitizePaystackErrorMessage(input.failureMessage),
              version: { increment: 1 },
            },
          });
        }
        if (
          freshPayment.latestAttemptNumber === freshAttempt.attemptNumber &&
          canTransitionPayment(freshPayment.status as PaymentState, "FAILED") &&
          freshPayment.status !== "FAILED"
        ) {
          assertPaymentTransition(freshPayment.status as PaymentState, "FAILED");
          await tx.payment.update({
            where: { id: freshPayment.id },
            data: {
              status: "FAILED",
              failedAt: now,
              ...(freshPayment.reconciliationStatus === "REQUIRED"
                ? { reconciliationStatus: "RESOLVED" as const }
                : {}),
              version: { increment: 1 },
            },
          });
          const history = await tx.paymentStatusHistory.create({
            data: {
              paymentId: freshPayment.id,
              attemptId: freshAttempt.id,
              fromStatus: freshPayment.status,
              toStatus: "FAILED",
              reasonCode: input.historyReasonCode,
              actorType: "PROVIDER",
              metadata: { trigger: input.trigger, providerStatus: input.providerStatus },
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
                summary: `Paystack Verify reported status ${input.providerStatus} for ${freshPayment.publicReference}.`,
                adminPath: `/admin/orders/${ord.id}`,
                relatedOrderId: ord.id,
                metadata: {
                  paymentReference: freshPayment.publicReference,
                  providerStatus: input.providerStatus,
                },
              });
            }
          }
        } else if (freshPayment.reconciliationStatus === "REQUIRED") {
          await tx.payment.update({
            where: { id: freshPayment.id },
            data: { reconciliationStatus: "RESOLVED" },
          });
        }
        await resolvePaymentReconciliationCasesWithinTransaction(
          tx,
          freshPayment.id,
          freshAttempt.id,
          "VERIFIED_FAILED",
        );
        return "FAILED_VIA_VERIFY" as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
  return Object.freeze({
    recovered: failResult === "ALREADY_SETTLED",
    outcome: failResult,
    paymentId: input.paymentId,
    paymentReference: input.paymentPublicReference,
    attemptId: input.attemptId,
    ledgerJournalReference: null,
  });
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
  allowStaleNotFound?: boolean;
  staleCutoff?: Date;
  expectedEnvironment?: "SANDBOX" | "PRODUCTION";
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

  if (attempt.status === "FAILED" && payment.status === "FAILED" && payment.reconciliationStatus !== "REQUIRED") {
    return SKIPPED("SKIPPED", {
      paymentId: payment.id,
      paymentReference: payment.publicReference,
      attemptId: attempt.id,
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

  const staleCutoff = input.staleCutoff ?? new Date(Date.now() - 30 * 60_000);
  const isStaleAttempt = Boolean(attempt.updatedAt && attempt.updatedAt < staleCutoff);
  const recoverableStatuses = new Set(["REQUIRES_ACTION", "PROCESSING", "UNKNOWN"]);
  const canVerifyUnsettled =
    recoverableStatuses.has(attempt.status) ||
    (Boolean(input.allowStaleNotFound) && isStaleAttempt && STALE_RECOVERABLE_ATTEMPT_STATUSES.has(attempt.status)) ||
    (payment.reconciliationStatus === "REQUIRED" && !["CANCELLED", "EXPIRED"].includes(attempt.status));
  if (!canVerifyUnsettled) {
    return SKIPPED("SKIPPED", {
      paymentId: payment.id,
      paymentReference: payment.publicReference,
      attemptId: attempt.id,
    });
  }

  const isQaPayment = Boolean((payment as { isQaAcceptance?: boolean }).isQaAcceptance);
  const client = resolveClient(input.clientOverride, isQaPayment);
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
  } catch (error) {
    const canCloseStaleNotFound =
      Boolean(input.allowStaleNotFound) &&
      isStaleAttempt &&
      STALE_NOT_FOUND_ELIGIBLE_STATUSES.has(attempt.status) &&
      error instanceof PaymentError &&
      error.code === "PAYSTACK_TRANSACTION_NOT_FOUND";
    if (canCloseStaleNotFound) {
      return recordPaystackAttemptFailureViaVerify({
        paymentId: payment.id,
        paymentPublicReference: payment.publicReference,
        orderId: payment.orderId ?? null,
        attemptId: attempt.id,
        trigger: input.trigger,
        providerStatus: "not_found",
        failureCategory: attempt.status === "UNKNOWN" ? "MALFORMED_RESPONSE" : "UNKNOWN_OUTCOME",
        failureCode: "PAYSTACK_TRANSACTION_NOT_FOUND",
        failureMessage: "Paystack confirmed no transaction exists for this stale uninitialized attempt.",
        historyReasonCode: "PAYSTACK_VERIFY_NOT_FOUND",
      });
    }
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
  const verifyStatus = typeof data?.status === "string" ? data.status.trim().toLowerCase() : "";
  const verifyRef = typeof data?.reference === "string" ? data.reference.trim() : undefined;
  const verifyCurrency = typeof data?.currency === "string" ? data.currency.trim().toUpperCase() : undefined;
  const verifyAmount = typeof data?.amount === "number" ? data.amount : undefined;
  const verifyDomain = typeof data?.domain === "string" ? data.domain.trim().toLowerCase() : undefined;
  const providerIdStr =
    data?.id !== undefined && data?.id !== null
      ? String(data.id)
      : (attempt.providerReference ?? attempt.merchantReference);

  const attemptCents = zarToSubunitCents(attempt.amount.toString());
  const paymentCents = zarToSubunitCents(payment.amount.toString());
  const attemptCurrency = (attempt as { currency?: string | null }).currency ?? "ZAR";
  const paymentCurrency = (payment as { currency?: string | null }).currency ?? "ZAR";
  const expectedEnv = input.expectedEnvironment ?? (attempt as { providerEnvironment?: string | null }).providerEnvironment;
  const expectedDomain =
    expectedEnv === "PRODUCTION" ? "live" : expectedEnv === "SANDBOX" ? "test" : null;

  const isMerchantMatching = Boolean(verifyRef) && verifyRef === attempt.merchantReference;
  const isDomainMatching = !expectedDomain || !verifyDomain || verifyDomain === expectedDomain;
  const isCurrencyMatching =
    verifyCurrency === "ZAR" && attemptCurrency === "ZAR" && paymentCurrency === "ZAR";
  const isAmountMatching =
    attemptCents === paymentCents &&
    verifyAmount !== undefined &&
    Number.isSafeInteger(verifyAmount) &&
    verifyAmount === attemptCents;

  if (ACTIVE_PENDING_VERIFY_STATUSES.has(verifyStatus)) {
    if (!isMerchantMatching || !isDomainMatching) {
      await openPaystackReconciliationRequiredInTx({
        paymentId: payment.id,
        orderId: payment.orderId ?? null,
        attemptId: attempt.id,
        reason: !isMerchantMatching ? "PROVIDER_REFERENCE_CONFLICT" : "MERCHANT_MISMATCH",
        safeEvidence: {
          source: "PAYSTACK_VERIFY_API_RECOVERY",
          trigger: input.trigger,
          verifiedStatus: verifyStatus,
          verifiedDomain: verifyDomain ?? "UNKNOWN",
        },
      });
      return SKIPPED("RECONCILIATION_REQUIRED", {
        paymentId: payment.id,
        paymentReference: payment.publicReference,
        attemptId: attempt.id,
      });
    }
    return SKIPPED("PENDING", {
      paymentId: payment.id,
      paymentReference: payment.publicReference,
      attemptId: attempt.id,
    });
  }

  if (verifyStatus === "reversed" || (verifyStatus !== "success" && verifyStatus !== "failed" && verifyStatus !== "abandoned")) {
    await openPaystackReconciliationRequiredInTx({
      paymentId: payment.id,
      orderId: payment.orderId ?? null,
      attemptId: attempt.id,
      reason: verifyStatus === "reversed" ? "CONFLICTING_PROVIDER_STATUS" : "UNRECOGNIZED_PROVIDER_STATUS",
      safeEvidence: {
        source: "PAYSTACK_VERIFY_API_RECOVERY",
        trigger: input.trigger,
        verifiedStatus: verifyStatus || "EMPTY",
        verifiedDomain: verifyDomain ?? "UNKNOWN",
      },
    });
    return SKIPPED("RECONCILIATION_REQUIRED", {
      paymentId: payment.id,
      paymentReference: payment.publicReference,
      attemptId: attempt.id,
    });
  }

  // Verify strict reference, domain/environment, currency, and exact integer subunit amount
  // BEFORE accepting either terminal failure or settlement.
  if (!isMerchantMatching || !isDomainMatching || !isCurrencyMatching || !isAmountMatching) {
    const reason: PaymentReconciliationReasonCode = !isMerchantMatching
      ? "PROVIDER_REFERENCE_CONFLICT"
      : !isDomainMatching
        ? "MERCHANT_MISMATCH"
        : "AMOUNT_MISMATCH";

    await openPaystackReconciliationRequiredInTx({
      paymentId: payment.id,
      orderId: payment.orderId ?? null,
      attemptId: attempt.id,
      reason,
      safeEvidence: {
        source: "PAYSTACK_VERIFY_API_RECOVERY",
        trigger: input.trigger,
        verifiedStatus: verifyStatus,
        expectedCents: attemptCents,
        paymentCents,
        receivedCents: verifyAmount ?? -1,
        verifiedCurrency: verifyCurrency ?? "UNKNOWN",
        verifiedDomain: verifyDomain ?? "UNKNOWN",
      },
    });

    return SKIPPED("RECONCILIATION_REQUIRED", {
      paymentId: payment.id,
      paymentReference: payment.publicReference,
      attemptId: attempt.id,
    });
  }

  // 3. Handle verified terminal failure/abandonment reported by Paystack
  if (verifyStatus === "failed" || verifyStatus === "abandoned") {
    return recordPaystackAttemptFailureViaVerify({
      paymentId: payment.id,
      paymentPublicReference: payment.publicReference,
      orderId: payment.orderId ?? null,
      attemptId: attempt.id,
      trigger: input.trigger,
      providerStatus: verifyStatus,
      failureCategory: "DECLINED",
      failureCode: `PAYSTACK_${verifyStatus.toUpperCase()}`,
      failureMessage:
        typeof data?.gateway_response === "string"
          ? data.gateway_response
          : `Paystack status: ${verifyStatus}`,
      historyReasonCode: "PAYSTACK_VERIFY_FAILED",
    });
  }

  // 4. Settle verified "success" inside Serializable tx using exact canonical ledger + confirmation pipeline
  const now = new Date();
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
        if (["CANCELLED", "EXPIRED", "FAILED"].includes(freshAttempt.status)) {
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

        let cash: { id: string; code: string; purpose: string; category: string } | undefined;
        let held: { id: string; code: string; purpose: string; category: string } | undefined;
        if (freshPayment.isQaAcceptance) {
          const sandbox = await ensureQaPlatformSandboxAccountsInTx(tx);
          cash = sandbox.cashClearing;
          held = sandbox.fundsHeld;
        } else {
          const accounts = await tx.ledgerAccount.findMany({
            where: {
              wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
              code: { in: ["PLATFORM-CASH-CLEARING-ZAR", "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR"] },
              currency: "ZAR",
              status: "ACTIVE",
            },
            select: { id: true, code: true, purpose: true, category: true },
          });
          cash = accounts.find(
            (a) => a.code === "PLATFORM-CASH-CLEARING-ZAR" && a.purpose === "CASH_CLEARING" && a.category === "ASSET",
          );
          held = accounts.find(
            (a) => a.code === "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" && a.purpose === "HELD" && a.category === "LIABILITY",
          );
        }
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
            const split = freshPayment.orderId
              ? await describeCourierOrderPaymentSplitFromDb(
                  tx,
                  freshPayment.orderId,
                  freshPayment.publicReference,
                ).catch(() => null)
              : null;
            postCommitAlert = {
              eventType: "PARCEL_ORDER_PAID",
              aggregateReference: `parcel:${freshPayment.orderId ?? freshPayment.publicReference}`,
              title:
                split?.adminPaidTitle ??
                `Parcel order paid (${freshPayment.publicReference})`,
              summary:
                split?.adminPaidSummary ??
                `Paystack Verify API confirmed R${freshPayment.amount.toFixed(2)}.`,
              adminPath: freshPayment.orderId ? `/admin/orders/${freshPayment.orderId}` : "/admin/orders",
              relatedOrderId: freshPayment.orderId ?? undefined,
              metadata: {
                paymentReference: freshPayment.publicReference,
                verifiedVia: "PAYSTACK_VERIFY_API",
                amountZar: freshPayment.amount.toFixed(2),
                ...(split
                  ? {
                      paymentMode: split.mode,
                      depositPaidZar: split.depositPaidZar,
                      cashDueZar: split.cashDueZar,
                    }
                  : {}),
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

  if (
    (txResult.outcome === "SETTLED_VIA_VERIFY" || txResult.outcome === "ALREADY_SETTLED") &&
    payment.subjectType === "MARKETPLACE_CHECKOUT"
  ) {
    const latest = await prisma.payment.findUnique({
      where: { id: payment.id },
      select: { status: true, marketplaceOrderId: true },
    });
    if (latest?.status === "SUCCEEDED" && !latest.marketplaceOrderId) {
      await onVerifiedMarketplacePaymentSucceededInProduction(payment.id).catch(() => undefined);
    }
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
  options: {
    trigger: string;
    clientOverride?: PaystackClient;
    allowStaleNotFound?: boolean;
    staleCutoff?: Date;
  },
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
    allowStaleNotFound: options.allowStaleNotFound,
    staleCutoff: options.staleCutoff,
  });
}

export type StalePaystackReconciliationItemReport = Readonly<{
  orderNumber: string | null;
  paymentPublicReference: string;
  attemptPublicReference: string | null;
  merchantReference: string;
  attemptStatus: string;
  paymentStatus: string;
  amountZar: string;
  currency: string;
  failureCategory: string | null;
  failureCode: string | null;
  outcome: PaystackVerifyRecoveryOutcome | "DRY_RUN" | "RECONCILIATION_OPENED";
  ledgerJournalReference: string | null;
}>;

export type StalePaystackReconciliationReport = Readonly<{
  mode: "DRY_RUN" | "APPLY";
  staleBefore: string;
  examined: number;
  settled: number;
  failed: number;
  reconciled: number;
  pending: number;
  skipped: number;
  items: readonly StalePaystackReconciliationItemReport[];
}>;

export type StalePaystackReconciliationCliOptions = Readonly<{
  mode: "DRY_RUN" | "APPLY";
  orderNumbers: readonly string[];
  merchantReferences: readonly string[];
  paymentPublicReferences: readonly string[];
  staleMinutes: number;
  limit: number;
}>;

export function parseStalePaystackReconciliationArgs(
  argv: readonly string[],
): StalePaystackReconciliationCliOptions {
  let mode: "DRY_RUN" | "APPLY" = "DRY_RUN";
  const orderNumbers: string[] = [];
  const merchantReferences: string[] = [];
  const paymentPublicReferences: string[] = [];
  let staleMinutes = 30;
  let limit = 25;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") {
      mode = "APPLY";
    } else if (arg === "--dry-run") {
      mode = "DRY_RUN";
    } else if (arg === "--order" && argv[i + 1]) {
      orderNumbers.push(argv[i + 1].trim());
      i += 1;
    } else if (arg === "--merchant-ref" && argv[i + 1]) {
      merchantReferences.push(argv[i + 1].trim());
      i += 1;
    } else if (arg === "--payment-ref" && argv[i + 1]) {
      paymentPublicReferences.push(argv[i + 1].trim());
      i += 1;
    } else if (arg === "--stale-minutes" && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10);
      if (Number.isInteger(parsed) && parsed >= 0) staleMinutes = parsed;
      i += 1;
    } else if (arg === "--limit" && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10);
      if (Number.isInteger(parsed) && parsed > 0) limit = Math.min(parsed, 100);
      i += 1;
    }
  }

  return Object.freeze({
    mode,
    orderNumbers: Object.freeze(orderNumbers.filter(Boolean)),
    merchantReferences: Object.freeze(merchantReferences.filter(Boolean)),
    paymentPublicReferences: Object.freeze(paymentPublicReferences.filter(Boolean)),
    staleMinutes,
    limit,
  });
}

export async function reconcileStalePaystackAttempts(options: {
  mode: "DRY_RUN" | "APPLY";
  staleBefore?: Date;
  limit?: number;
  orderNumbers?: readonly string[];
  merchantReferences?: readonly string[];
  paymentPublicReferences?: readonly string[];
  trigger?: string;
  clientOverride?: PaystackClient;
}): Promise<StalePaystackReconciliationReport> {
  const staleBefore = options.staleBefore ?? new Date(Date.now() - 30 * 60_000);
  const take = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const trigger = options.trigger ?? "stale_paystack_reconciliation";

  const paymentFilter: Prisma.PaymentWhereInput = {
    ...(options.paymentPublicReferences?.length
      ? { publicReference: { in: [...options.paymentPublicReferences] } }
      : {}),
    ...(options.orderNumbers?.length
      ? { order: { orderNumber: { in: [...options.orderNumbers] } } }
      : {}),
  };

  const candidates = await prisma.paymentAttempt.findMany({
    where: {
      provider: "PAYSTACK",
      ...(options.merchantReferences?.length
        ? { merchantReference: { in: [...options.merchantReferences] } }
        : {}),
      ...(Object.keys(paymentFilter).length > 0 ? { payment: paymentFilter } : {}),
      OR: [
        { status: { in: ["UNKNOWN", "RESERVED", "REQUESTING"] }, updatedAt: { lt: staleBefore } },
        {
          status: "PROCESSING",
          updatedAt: { lt: staleBefore },
          webhookEvents: { none: { providerDataVerified: true } },
        },
        {
          status: "REQUIRES_ACTION",
          updatedAt: { lt: staleBefore },
          OR: [{ expiresAt: null }, { expiresAt: { lt: staleBefore } }],
        },
        {
          status: { in: ["REQUIRES_ACTION", "PROCESSING", "UNKNOWN", "RESERVED", "REQUESTING"] },
          payment: { reconciliationStatus: "REQUIRED" },
        },
      ],
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take,
    include: {
      payment: {
        include: {
          order: { select: { orderNumber: true } },
        },
      },
    },
  });

  const items: StalePaystackReconciliationItemReport[] = [];
  let settled = 0;
  let failed = 0;
  let reconciled = 0;
  const pending = 0;
  let skipped = 0;

  for (const attempt of candidates) {
    const orderNumber = attempt.payment.order?.orderNumber ?? null;
    const baseItem = {
      orderNumber,
      paymentPublicReference: attempt.payment.publicReference,
      attemptPublicReference: attempt.publicReference ?? null,
      merchantReference: attempt.merchantReference,
      attemptStatus: attempt.status,
      paymentStatus: attempt.payment.status,
      amountZar: attempt.amount.toFixed(2),
      currency: attempt.currency,
      failureCategory: attempt.failureCategory ?? null,
      failureCode: attempt.failureCode ?? null,
    };

    if (options.mode === "DRY_RUN") {
      skipped += 1;
      items.push({ ...baseItem, outcome: "DRY_RUN", ledgerJournalReference: null });
      continue;
    }

    const recovery = await recoverPaystackAttemptViaVerify({
      attemptId: attempt.id,
      trigger,
      clientOverride: options.clientOverride,
      allowStaleNotFound: true,
      staleCutoff: staleBefore,
    });

    if (
      recovery.outcome === "SETTLED_VIA_VERIFY" ||
      recovery.outcome === "ALREADY_SETTLED" ||
      recovery.outcome === "APPLIED_WEBHOOK"
    ) {
      settled += 1;
      items.push({
        ...baseItem,
        outcome: recovery.outcome,
        ledgerJournalReference: recovery.ledgerJournalReference,
      });
      continue;
    }

    if (recovery.outcome === "FAILED_VIA_VERIFY") {
      failed += 1;
      items.push({
        ...baseItem,
        outcome: recovery.outcome,
        ledgerJournalReference: null,
      });
      continue;
    }

    if (recovery.outcome === "RECONCILIATION_REQUIRED") {
      reconciled += 1;
      items.push({
        ...baseItem,
        outcome: recovery.outcome,
        ledgerJournalReference: null,
      });
      continue;
    }

    if (
      recovery.outcome === "SKIPPED" ||
      ["FAILED", "CANCELLED", "EXPIRED"].includes(attempt.payment.status)
    ) {
      skipped += 1;
      items.push({
        ...baseItem,
        outcome: recovery.outcome,
        ledgerJournalReference: null,
      });
      continue;
    }

    await openPaystackReconciliationRequiredInTx({
      paymentId: attempt.paymentId,
      orderId: attempt.payment.orderId ?? null,
      attemptId: attempt.id,
      reason: "STALE_PROCESSING_ATTEMPT",
      safeEvidence: {
        source: trigger,
        attemptReference: attempt.publicReference ?? attempt.merchantReference,
        observedStatus: attempt.status,
      },
    });
    reconciled += 1;
    items.push({
      ...baseItem,
      outcome: "RECONCILIATION_OPENED",
      ledgerJournalReference: null,
    });
  }

  return Object.freeze({
    mode: options.mode,
    staleBefore: staleBefore.toISOString(),
    examined: candidates.length,
    settled,
    failed,
    reconciled,
    pending,
    skipped,
    items: Object.freeze(items),
  });
}
