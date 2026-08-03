import type { RefundMethodCode, RefundReasonCodeValue, RefundStatusCode } from "@/lib/refunds/types";

export type CustomerRefundListItemDto = Readonly<{
  publicReference: string;
  paymentReference: string;
  orderReference: string;
  amount: string;
  currency: "ZAR";
  status: RefundStatusCode;
  method: RefundMethodCode;
  reasonCode: RefundReasonCodeValue;
  requestedAt: string;
  completedAt: string | null;
  canCancel: boolean;
}>;

export type CustomerRefundDetailDto = CustomerRefundListItemDto & Readonly<{
  customerNote: string | null;
  progress: readonly Readonly<{ status: RefundStatusCode; reasonCode: string; createdAt: string }>[];
  productionLock: Readonly<{ active: true; blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" }>;
}>;

export type FinanceRefundListItemDto = Readonly<{
  id: string;
  publicReference: string;
  paymentReference: string;
  orderReference: string;
  customer: Readonly<{ name: string; email: string }>;
  amount: string;
  currency: "ZAR";
  status: RefundStatusCode;
  method: RefundMethodCode;
  reasonCode: RefundReasonCodeValue;
  requestedAt: string;
  reconciliationRequired: boolean;
}>;

