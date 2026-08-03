export type WithdrawalErrorCode =
  | "WITHDRAWAL_INVALID_INPUT"
  | "WITHDRAWAL_OWNER_INELIGIBLE"
  | "WITHDRAWAL_POLICY_DISABLED"
  | "WITHDRAWAL_POLICY_LIMIT"
  | "WITHDRAWAL_DESTINATION_INVALID"
  | "WITHDRAWAL_DESTINATION_INACTIVE"
  | "WITHDRAWAL_ACCOUNT_INVALID"
  | "WITHDRAWAL_INSUFFICIENT_BALANCE"
  | "WITHDRAWAL_IDEMPOTENCY_CONFLICT"
  | "WITHDRAWAL_NOT_FOUND"
  | "WITHDRAWAL_FORBIDDEN"
  | "WITHDRAWAL_INVALID_STATE"
  | "WITHDRAWAL_PRODUCTION_LOCKED"
  | "WITHDRAWAL_DUAL_CONTROL_REQUIRED"
  | "WITHDRAWAL_PAYOUT_NOT_FOUND"
  | "WITHDRAWAL_PAYOUT_REFERENCE_CONFLICT"
  | "WITHDRAWAL_CASH_INSUFFICIENT"
  | "WITHDRAWAL_RECONCILIATION_REQUIRED";

export class WithdrawalError extends Error {
  readonly code: WithdrawalErrorCode;
  readonly retryable: boolean;

  constructor(code: WithdrawalErrorCode, message: string, options?: { retryable?: boolean; cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "WithdrawalError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
  }
}
