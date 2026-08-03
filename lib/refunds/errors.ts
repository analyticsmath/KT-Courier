export type RefundErrorCode =
  | "REFUND_INVALID_INPUT"
  | "REFUND_NOT_FOUND"
  | "REFUND_FORBIDDEN"
  | "REFUND_PAYMENT_INELIGIBLE"
  | "REFUND_AMOUNT_EXCEEDS_REMAINING"
  | "REFUND_IDEMPOTENCY_CONFLICT"
  | "REFUND_INVALID_STATE"
  | "REFUND_DUAL_CONTROL_REQUIRED"
  | "REFUND_FUNDING_UNAVAILABLE"
  | "REFUND_COMMISSION_RELEASED"
  | "REFUND_LEDGER_INCOHERENT"
  | "REFUND_PROVIDER_UNSUPPORTED"
  | "REFUND_PROVIDER_NOT_READY"
  | "REFUND_PROVIDER_OUTCOME_UNKNOWN"
  | "REFUND_PROVIDER_RESPONSE_INVALID"
  | "REFUND_PROVIDER_REFERENCE_CONFLICT"
  | "REFUND_CASH_INSUFFICIENT"
  | "REFUND_PRODUCTION_NOT_READY"
  | "REFUND_CONCURRENCY_CONFLICT";

export class RefundError extends Error {
  constructor(
    public readonly code: RefundErrorCode,
    message: string,
    public readonly retryable = false,
    options?: { cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "RefundError";
  }
}

