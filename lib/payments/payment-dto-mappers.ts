import type { Prisma } from "@prisma/client";
import type {
  PaymentAttemptDto,
  PaymentHistoryDto,
  PaymentSummaryDto,
} from "@/lib/dto/payment.dto";
import type {
  PaymentAttemptState,
  PaymentCustomerActionType,
  PaymentProviderCode,
  PaymentProviderEnvironment,
  PaymentState,
} from "./types";
import type { PaymentProviderFailureCategory } from "./providers/provider-errors";
import { PaymentError } from "./errors";

export function toPaymentSummaryDto(payment: {
  id: string;
  publicReference: string;
  provider: string | null;
  status: string;
  amount: Prisma.Decimal;
  currency: string;
  version: number;
  latestAttemptNumber: number;
  expiresAt: Date | null;
  succeededAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  successfulAttemptId?: string | null;
  successWebhookEventId?: string | null;
  successLedgerJournalId?: string | null;
  providerConfirmedAt?: Date | null;
  reconciliationStatus?: string;
  createdAt: Date;
  updatedAt: Date;
  order: { id: string; orderNumber: string } | null;
  user: { id: string; name: string | null } | null;
}): PaymentSummaryDto {
  if (!payment.order || !payment.user) {
    throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", "Payment subject relationships are incomplete.");
  }
  return Object.freeze({
    id: payment.id,
    publicReference: payment.publicReference,
    order: Object.freeze({ id: payment.order.id, reference: payment.order.orderNumber }),
    payer: Object.freeze({
      id: payment.user.id,
      label: payment.user.name?.trim() || `Payer ${payment.user.id.slice(0, 8)}`,
    }),
    provider: payment.provider as PaymentProviderCode | null,
    status: payment.status as PaymentState,
    amount: payment.amount.toFixed(2),
    currency: "ZAR",
    version: payment.version,
    latestAttemptNumber: payment.latestAttemptNumber,
    expiresAt: payment.expiresAt?.toISOString() ?? null,
    succeededAt: payment.succeededAt?.toISOString() ?? null,
    failedAt: payment.failedAt?.toISOString() ?? null,
    cancelledAt: payment.cancelledAt?.toISOString() ?? null,
    successfulAttemptId: payment.successfulAttemptId ?? null,
    successWebhookEventId: payment.successWebhookEventId ?? null,
    successLedgerJournalId: payment.successLedgerJournalId ?? null,
    providerConfirmedAt: payment.providerConfirmedAt?.toISOString() ?? null,
    reconciliationStatus: (payment.reconciliationStatus ?? "CLEAR") as PaymentSummaryDto["reconciliationStatus"],
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  });
}

export function toPaymentAttemptDto(attempt: {
  id: string;
  publicReference: string | null;
  attemptNumber: number;
  provider: string;
  merchantReference: string;
  providerReference: string | null;
  status: string;
  amount: Prisma.Decimal;
  currency: string;
  redirectUrl: string | null;
  providerEnvironment: string | null;
  checkoutActionType: string | null;
  checkoutPreparedAt: Date | null;
  providerProtocolVersion: string | null;
  configurationFingerprint: string | null;
  expiresAt: Date | null;
  providerStatusCode: string | null;
  failureCategory: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  providerConfirmedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PaymentAttemptDto {
  return Object.freeze({
    id: attempt.id,
    publicReference: attempt.publicReference,
    attemptNumber: attempt.attemptNumber,
    provider: attempt.provider as PaymentProviderCode,
    merchantReference: attempt.merchantReference,
    providerReference: attempt.providerReference,
    status: attempt.status as PaymentAttemptState,
    amount: attempt.amount.toFixed(2),
    currency: "ZAR",
    redirectUrl: attempt.redirectUrl,
    providerEnvironment: attempt.providerEnvironment as PaymentProviderEnvironment | null,
    checkoutActionType: attempt.checkoutActionType as PaymentCustomerActionType | null,
    checkoutPreparedAt: attempt.checkoutPreparedAt?.toISOString() ?? null,
    providerProtocolVersion: attempt.providerProtocolVersion,
    configurationFingerprint: attempt.configurationFingerprint,
    expiresAt: attempt.expiresAt?.toISOString() ?? null,
    providerStatusCode: attempt.providerStatusCode,
    failureCategory: attempt.failureCategory as PaymentProviderFailureCategory | null,
    failureCode: attempt.failureCode,
    failureMessage: attempt.failureMessage,
    startedAt: attempt.startedAt?.toISOString() ?? null,
    completedAt: attempt.completedAt?.toISOString() ?? null,
    providerConfirmedAt: attempt.providerConfirmedAt?.toISOString() ?? null,
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
  });
}

export function toPaymentHistoryDto(history: {
  id: string;
  attemptId: string | null;
  fromStatus: string | null;
  toStatus: string;
  reasonCode: string | null;
  actorType: string;
  createdAt: Date;
}): PaymentHistoryDto {
  return Object.freeze({
    id: history.id,
    attemptId: history.attemptId,
    fromStatus: history.fromStatus as PaymentState | null,
    toStatus: history.toStatus as PaymentState,
    reasonCode: history.reasonCode,
    actorType: history.actorType as PaymentHistoryDto["actorType"],
    createdAt: history.createdAt.toISOString(),
  });
}
