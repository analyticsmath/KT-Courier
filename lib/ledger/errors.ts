export type LedgerErrorCode =
  | "LEDGER_WALLET_NOT_FOUND"
  | "LEDGER_WALLET_INACTIVE"
  | "LEDGER_ACCOUNT_NOT_FOUND"
  | "LEDGER_ACCOUNT_FROZEN"
  | "LEDGER_ACCOUNT_CLOSED"
  | "LEDGER_ACCOUNT_CURRENCY_MISMATCH"
  | "LEDGER_INVALID_AMOUNT"
  | "LEDGER_PRECISION_EXCEEDED"
  | "LEDGER_UNBALANCED_JOURNAL"
  | "LEDGER_INSUFFICIENT_ENTRIES"
  | "LEDGER_DUPLICATE_LINE_CODE"
  | "LEDGER_DUPLICATE_ACCOUNT_LINE"
  | "LEDGER_INSUFFICIENT_BALANCE"
  | "LEDGER_IDEMPOTENCY_CONFLICT"
  | "LEDGER_SOURCE_REFERENCE_CONFLICT"
  | "LEDGER_POSTING_CONCURRENCY_CONFLICT"
  | "LEDGER_JOURNAL_NOT_FOUND"
  | "LEDGER_JOURNAL_ALREADY_REVERSED"
  | "LEDGER_REVERSAL_NOT_ALLOWED"
  | "LEDGER_METADATA_INVALID"
  | "LEDGER_OWNER_INVALID"
  | "LEDGER_SOURCE_REFERENCE_INVALID";

export class LedgerError extends Error {
  readonly code: LedgerErrorCode;
  readonly retryable: boolean;

  constructor(code: LedgerErrorCode, message: string, options?: { retryable?: boolean; cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "LedgerError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
  }
}

export function ledgerError(code: LedgerErrorCode, message: string): LedgerError {
  return new LedgerError(code, message);
}

