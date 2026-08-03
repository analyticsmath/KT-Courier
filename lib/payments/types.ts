export const PAYMENT_STATES = [
  "CREATED",
  "PROVIDER_PENDING",
  "REQUIRES_ACTION",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type PaymentState = (typeof PAYMENT_STATES)[number];

export const PAYMENT_ATTEMPT_STATES = [
  "RESERVED",
  "REQUESTING",
  "REQUIRES_ACTION",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "UNKNOWN",
] as const;

export type PaymentAttemptState = (typeof PAYMENT_ATTEMPT_STATES)[number];
export type PaymentProviderCode = "PAYFAST";
export type PaymentCurrency = "ZAR";
export type PaymentProviderEnvironment = "SANDBOX" | "PRODUCTION";
export type PaymentCustomerActionType = "FORM_POST" | "REDIRECT_GET";
export type PaymentWebhookNormalizedStatusCode = "COMPLETE" | "PENDING" | "FAILED" | "UNKNOWN";
export type PaymentWebhookProcessingStatusCode =
  | "RECEIVED" | "REJECTED" | "VERIFIED" | "APPLIED" | "DUPLICATE"
  | "IGNORED_STALE" | "RECONCILIATION_REQUIRED" | "TEMPORARY_FAILURE";
export type PaymentReconciliationReasonCode =
  | "UNKNOWN_OUTCOME" | "CREDENTIAL_VERSION_MISMATCH" | "PROVIDER_CONFIRMATION_UNAVAILABLE"
  | "CONFLICTING_PROVIDER_STATUS" | "OUT_OF_ORDER_EVENT" | "AMOUNT_MISMATCH"
  | "MERCHANT_MISMATCH" | "PROVIDER_REFERENCE_CONFLICT" | "UNRECOGNIZED_PROVIDER_STATUS"
  | "APPLICATION_FAILURE_AFTER_VERIFICATION" | "STALE_PROCESSING_ATTEMPT";

export const PAYMENT_POLICY_VERSION = "phase10-payment-v1";
export const PAYMENT_SESSION_POLICY_VERSION = "phase11-provider-session-v1";
export const PAYMENT_CONFIRMATION_POLICY_VERSION = "phase12-payfast-confirmation-v1";
