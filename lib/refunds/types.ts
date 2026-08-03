export const REFUND_METHODS = ["CUSTOMER_WALLET", "ORIGINAL_PAYMENT_METHOD"] as const;
export type RefundMethodCode = (typeof REFUND_METHODS)[number];

export const REFUND_STATUSES = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PROCESSING",
  "SUCCEEDED",
  "REJECTED",
  "CANCELLED",
  "RECONCILIATION_REQUIRED",
] as const;
export type RefundStatusCode = (typeof REFUND_STATUSES)[number];

export const REFUND_REASON_CODES = [
  "ORDER_CANCELLED",
  "SERVICE_NOT_PROVIDED",
  "DUPLICATE_PAYMENT",
  "OVERPAYMENT",
  "SERVICE_FAILURE",
  "CUSTOMER_SERVICE_RESOLUTION",
  "OTHER_REVIEWED",
] as const;
export type RefundReasonCodeValue = (typeof REFUND_REASON_CODES)[number];

export const REFUND_ATTEMPT_STATUSES = ["RESERVED", "PROCESSING", "SUCCEEDED", "FAILED", "UNKNOWN"] as const;
export type RefundAttemptStatusCode = (typeof REFUND_ATTEMPT_STATUSES)[number];

export type RefundFundingSourceCode =
  | "CUSTOMER_FUNDS_HELD"
  | "PLATFORM_COMMISSION_REVENUE"
  | "BENEFICIARY_COMMISSION_PAYABLE"
  | "STORE_EARNINGS_PAYABLE"
  | "DRIVER_EARNINGS_PAYABLE";

export const REFUND_POLICY_VERSION = 1 as const;
export const REFUND_POLICY_LABEL = "refund-policy-v1" as const;
