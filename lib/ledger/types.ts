import type { LedgerMoney } from "./money";

export type LedgerCurrencyCode = "ZAR";
export type LedgerEntryDirectionCode = "DEBIT" | "CREDIT";
export type LedgerAccountCategoryCode = "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE" | "EQUITY";
export type LedgerAccountStatusCode = "ACTIVE" | "FROZEN" | "CLOSED";
export type LedgerAccountPurposeCode =
  | "AVAILABLE"
  | "PENDING"
  | "HELD"
  | "OWNER_WITHDRAWABLE"
  | "WITHDRAWAL_HELD"
  | "CASH_CLEARING"
  | "SETTLEMENT_CLEARING"
  | "PLATFORM_REVENUE"
  | "COMMISSION_PAYABLE"
  | "ADJUSTMENT"
  | "SUSPENSE"
  | "OPENING_BALANCE_CONTROL"
  | "CUSTOMER_WALLET_AVAILABLE"
  | "CUSTOMER_REFUND_HELD"
  | "STORE_EARNINGS_PAYABLE"
  | "DRIVER_EARNINGS_PAYABLE"
  | "SUBSCRIPTION_DEFERRED_REVENUE"
  | "SUBSCRIPTION_TAX_PAYABLE";
export type LedgerJournalTypeCode =
  | "GENERAL"
  | "ACCOUNT_TRANSFER"
  | "OPENING_BALANCE"
  | "REVERSAL"
  | "EXTERNAL_PAYMENT_RECEIPT"
  | "WITHDRAWAL_RESERVE"
  | "WITHDRAWAL_RELEASE"
  | "WITHDRAWAL_PAYOUT"
  | "COMMISSION_ACCRUAL"
  | "COMMISSION_REVERSAL"
  | "REFUND_RESERVE"
  | "REFUND_RELEASE"
  | "REFUND_WALLET_CREDIT"
  | "REFUND_EXTERNAL_PAYOUT"
  | "STORE_EARNING_ACCRUAL"
  | "STORE_EARNING_RELEASE"
  | "STORE_EARNING_REVERSAL"
  | "DRIVER_EARNING_ACCRUAL"
  | "DRIVER_EARNING_RELEASE"
  | "DRIVER_EARNING_REVERSAL"
  | "SUBSCRIPTION_INVOICE_SETTLEMENT"
  | "SUBSCRIPTION_REVENUE_RECOGNITION"
  | "SUBSCRIPTION_REFUND_REVERSAL";
export type LedgerOwnerTypeCode = "CUSTOMER" | "STORE" | "DRIVER" | "PROMOTER" | "PLATFORM";

export type LedgerJsonPrimitive = string | boolean | null;
export type LedgerJsonValue = LedgerJsonPrimitive | LedgerJsonValue[] | { [key: string]: LedgerJsonValue };
export type SafeLedgerMetadata = Readonly<Record<string, LedgerJsonValue>>;

export type LedgerActor = Readonly<
  | { kind: "SYSTEM"; userId?: never }
  | { kind: "USER"; userId: string }
>;

export type LedgerPostingEntryInput = Readonly<{
  accountId: string;
  direction: LedgerEntryDirectionCode;
  amount: string;
  lineCode: string;
  memo?: string;
}>;

export type PostLedgerJournalInput = Readonly<{
  idempotencyKey: string;
  type: LedgerJournalTypeCode;
  currency: LedgerCurrencyCode;
  sourceReference?: string;
  correlationId?: string;
  memo?: string;
  metadata?: unknown;
  actor: LedgerActor;
  reversalOfJournalId?: string;
  entries: readonly LedgerPostingEntryInput[];
}>;

export type NormalizedLedgerEntry = Readonly<{
  accountId: string;
  direction: LedgerEntryDirectionCode;
  amount: LedgerMoney;
  currency: LedgerCurrencyCode;
  lineCode: string;
  memo?: string;
}>;

export type NormalizedLedgerPosting = Readonly<{
  idempotencyKey: string;
  type: LedgerJournalTypeCode;
  currency: LedgerCurrencyCode;
  sourceReference?: string;
  correlationId?: string;
  memo?: string;
  metadata?: SafeLedgerMetadata;
  actor: LedgerActor;
  reversalOfJournalId?: string;
  policyVersion: string;
  entries: readonly NormalizedLedgerEntry[];
  totalDebits: LedgerMoney;
  totalCredits: LedgerMoney;
}>;

export type LedgerAccountPolicySnapshot = Readonly<{
  id: string;
  category: LedgerAccountCategoryCode;
  currency: LedgerCurrencyCode;
  status: LedgerAccountStatusCode;
  allowNegative: boolean;
  currentBalance: LedgerMoney;
  debitTotal: LedgerMoney;
  creditTotal: LedgerMoney;
  version: number;
}>;
