import type { PaymentPaginationDto } from "./payment.dto";

export type PaymentWebhookVerificationDto = Readonly<{
  sourceAddress: boolean;
  signature: boolean;
  merchant: boolean;
  amount: boolean;
  providerConfirmation: boolean;
}>;

export type PaymentWebhookListItemDto = Readonly<{
  publicReference: string;
  provider: "PAYFAST";
  environment: "SANDBOX" | "PRODUCTION";
  providerStatus: string;
  normalizedStatus: "COMPLETE" | "PENDING" | "FAILED" | "UNKNOWN";
  processingStatus: string;
  paymentReference: string | null;
  attemptReference: string | null;
  providerPaymentId: string | null;
  amount: string | null;
  reconciliationRequired: boolean;
  receivedAt: string;
  appliedAt: string | null;
}>;

export type PaymentWebhookDetailDto = PaymentWebhookListItemDto & Readonly<{
  verification: PaymentWebhookVerificationDto;
  rejectionCode: string | null;
  ledgerJournal: Readonly<{ id: string; reference: string }> | null;
  reconciliationCases: readonly Readonly<{ publicReference: string; reason: string; status: string }> [];
  verifiedAt: string | null;
}>;

export type PaymentWebhookListDto = Readonly<{ data: readonly PaymentWebhookListItemDto[]; pagination: PaymentPaginationDto }>;

export type PaymentReconciliationListItemDto = Readonly<{
  publicReference: string;
  reason: string;
  status: string;
  priority: string;
  summary: string;
  paymentReference: string;
  attemptReference: string | null;
  eventReference: string | null;
  observationCount: number;
  openedAt: string;
  lastObservedAt: string;
  resolvedAt: string | null;
}>;

export type PaymentReconciliationDetailDto = PaymentReconciliationListItemDto & Readonly<{
  resolutionCode: string | null;
  safeEvidence: Readonly<Record<string, string | number | boolean | null>> | null;
}>;

export type PaymentReconciliationListDto = Readonly<{ data: readonly PaymentReconciliationListItemDto[]; pagination: PaymentPaginationDto }>;
