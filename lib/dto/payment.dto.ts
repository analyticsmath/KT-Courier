import type {
  PaymentAttemptState,
  PaymentCurrency,
  PaymentCustomerActionType,
  PaymentProviderCode,
  PaymentProviderEnvironment,
  PaymentState,
} from "@/lib/payments/types";
import type { PaymentProviderFailureCategory } from "@/lib/payments/providers/provider-errors";
import type { PaymentProviderReadinessDto } from "@/lib/payments/providers/payment-provider-registry";

export type PaymentPaginationDto = Readonly<{
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>;

export type SafePayerSummaryDto = Readonly<{
  id: string;
  label: string;
}>;

export type PaymentSummaryDto = Readonly<{
  id: string;
  publicReference: string;
  order: Readonly<{ id: string; reference: string }>;
  payer: SafePayerSummaryDto;
  provider: PaymentProviderCode | null;
  status: PaymentState;
  amount: string;
  currency: PaymentCurrency;
  version: number;
  latestAttemptNumber: number;
  expiresAt: string | null;
  succeededAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  successfulAttemptId: string | null;
  successWebhookEventId: string | null;
  successLedgerJournalId: string | null;
  providerConfirmedAt: string | null;
  reconciliationStatus: "CLEAR" | "REQUIRED" | "RESOLVED";
  createdAt: string;
  updatedAt: string;
}>;

export type PaymentAttemptDto = Readonly<{
  id: string;
  publicReference: string | null;
  attemptNumber: number;
  provider: PaymentProviderCode;
  merchantReference: string;
  providerReference: string | null;
  status: PaymentAttemptState;
  amount: string;
  currency: PaymentCurrency;
  redirectUrl: string | null;
  providerEnvironment: PaymentProviderEnvironment | null;
  checkoutActionType: PaymentCustomerActionType | null;
  checkoutPreparedAt: string | null;
  providerProtocolVersion: string | null;
  configurationFingerprint: string | null;
  expiresAt: string | null;
  providerStatusCode: string | null;
  failureCategory: PaymentProviderFailureCategory | null;
  failureCode: string | null;
  failureMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  providerConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type PaymentHistoryDto = Readonly<{
  id: string;
  attemptId: string | null;
  fromStatus: PaymentState | null;
  toStatus: PaymentState;
  reasonCode: string | null;
  actorType: "SYSTEM" | "PAYER" | "ADMIN" | "PROVIDER";
  createdAt: string;
}>;

export type PaymentDetailDto = Readonly<{
  payment: PaymentSummaryDto;
  attempts: readonly PaymentAttemptDto[];
  history: readonly PaymentHistoryDto[];
}>;

export type PaymentListDto = Readonly<{
  data: readonly PaymentSummaryDto[];
  pagination: PaymentPaginationDto;
}>;

export type PaymentProviderListDto = Readonly<{
  data: readonly PaymentProviderReadinessDto[];
}>;

export type ProviderSessionDto = Readonly<{
  paymentId: string;
  paymentStatus: PaymentState;
  attempt: PaymentAttemptDto;
  replayed: boolean;
}>;

export type CustomerPaymentStatusDto = Readonly<{
  publicReference: string;
  orderReference: string;
  amount: string;
  currency: PaymentCurrency;
  provider: PaymentProviderCode | null;
  status: PaymentState;
  updatedAt: string;
}>;

export type CustomerPaymentPageDto = Readonly<{
  orderId: string;
  orderReference: string;
  amount: string;
  currency: PaymentCurrency;
  payment: CustomerPaymentStatusDto | null;
}>;
