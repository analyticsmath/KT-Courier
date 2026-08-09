import {
  LEDGER_CURRENCY,
  LEDGER_MAX_KEY_LENGTH,
  LEDGER_MAX_LINE_CODE_LENGTH,
  LEDGER_MAX_LINE_MEMO_LENGTH,
  LEDGER_MAX_MEMO_LENGTH,
  LEDGER_POLICY_VERSION,
} from "./config";
import { LedgerError } from "./errors";
import { validateJournalPolicy } from "./journal-policy";
import { sanitizeLedgerMetadata } from "./metadata";
import { LedgerMoney } from "./money";
import type {
  LedgerActor,
  LedgerEntryDirectionCode,
  LedgerJournalTypeCode,
  NormalizedLedgerEntry,
  NormalizedLedgerPosting,
  PostLedgerJournalInput,
} from "./types";

const DIRECTIONS = new Set<LedgerEntryDirectionCode>(["DEBIT", "CREDIT"]);
const SAFE_CODE = /^[A-Z0-9][A-Z0-9._:-]*$/;

const JOURNAL_TYPES = new Set<LedgerJournalTypeCode>([
  "GENERAL",
  "ACCOUNT_TRANSFER",
  "OPENING_BALANCE",
  "REVERSAL",
  "EXTERNAL_PAYMENT_RECEIPT",
  "WITHDRAWAL_RESERVE",
  "WITHDRAWAL_RELEASE",
  "WITHDRAWAL_PAYOUT",
  "COMMISSION_ACCRUAL",
  "COMMISSION_REVERSAL",
  "REFUND_RESERVE",
  "REFUND_RELEASE",
  "REFUND_WALLET_CREDIT",
  "REFUND_EXTERNAL_PAYOUT",
  "STORE_EARNING_ACCRUAL",
  "STORE_EARNING_RELEASE",
  "STORE_EARNING_REVERSAL",
  "DRIVER_EARNING_ACCRUAL",
  "DRIVER_EARNING_RELEASE",
  "DRIVER_EARNING_REVERSAL",
  "SUBSCRIPTION_INVOICE_SETTLEMENT",
  "SUBSCRIPTION_REVENUE_RECOGNITION",
  "SUBSCRIPTION_REFUND_REVERSAL",
]);

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new LedgerError("LEDGER_INVALID_AMOUNT", `${field} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new LedgerError("LEDGER_INVALID_AMOUNT", `${field} is empty or exceeds its maximum length.`);
  }
  return normalized;
}

function optionalText(value: unknown, field: string, maxLength: number, uppercase = false): string | undefined {
  if (value === undefined) return undefined;
  const normalized = requiredText(value, field, maxLength);
  return uppercase ? normalized.toUpperCase() : normalized;
}

function normalizeActor(actor: LedgerActor): LedgerActor {
  if (!actor || (actor.kind !== "SYSTEM" && actor.kind !== "USER")) {
    throw new LedgerError("LEDGER_OWNER_INVALID", "A valid ledger actor is required.");
  }
  if (actor.kind === "USER") {
    return Object.freeze({ kind: "USER", userId: requiredText(actor.userId, "actor.userId", LEDGER_MAX_KEY_LENGTH) });
  }
  return Object.freeze({ kind: "SYSTEM" });
}

export function normalizeLedgerPosting(input: PostLedgerJournalInput): NormalizedLedgerPosting {
  if (!input || typeof input !== "object") {
    throw new LedgerError("LEDGER_UNBALANCED_JOURNAL", "Ledger posting input is required.");
  }
  if (input.currency !== LEDGER_CURRENCY) {
    throw new LedgerError("LEDGER_ACCOUNT_CURRENCY_MISMATCH", "Phase 9 supports ZAR journals only.");
  }
  if (!JOURNAL_TYPES.has(input.type)) {
    throw new LedgerError("LEDGER_UNBALANCED_JOURNAL", "Ledger journal type is invalid.");
  }
  if (!Array.isArray(input.entries)) {
    throw new LedgerError("LEDGER_INSUFFICIENT_ENTRIES", "Ledger entries must be an array.");
  }
  const reversalType = input.type === "REVERSAL" || input.type === "COMMISSION_REVERSAL";
  if (reversalType !== Boolean(input.reversalOfJournalId)) {
    throw new LedgerError("LEDGER_REVERSAL_NOT_ALLOWED", "Reversal journals require exactly one original-journal reference.");
  }

  const entries = input.entries.map<NormalizedLedgerEntry>((entry) => {
    if (!entry || typeof entry !== "object" || !DIRECTIONS.has(entry.direction)) {
      throw new LedgerError("LEDGER_UNBALANCED_JOURNAL", "Ledger entry direction is invalid.");
    }
    const lineCode = requiredText(entry.lineCode, "lineCode", LEDGER_MAX_LINE_CODE_LENGTH).toUpperCase();
    if (!SAFE_CODE.test(lineCode)) {
      throw new LedgerError("LEDGER_DUPLICATE_LINE_CODE", "Ledger line code contains unsupported characters.");
    }
    return Object.freeze({
      accountId: requiredText(entry.accountId, "accountId", LEDGER_MAX_KEY_LENGTH),
      direction: entry.direction,
      amount: LedgerMoney.parse(entry.amount),
      currency: LEDGER_CURRENCY,
      lineCode,
      memo: optionalText(entry.memo, "entry.memo", LEDGER_MAX_LINE_MEMO_LENGTH),
    });
  });

  const sortedEntries = Object.freeze(
    [...entries].sort((left, right) =>
      left.accountId.localeCompare(right.accountId) ||
      left.direction.localeCompare(right.direction) ||
      left.lineCode.localeCompare(right.lineCode) ||
      left.amount.toString().localeCompare(right.amount.toString()) ||
      (left.memo ?? "").localeCompare(right.memo ?? "")
    )
  );
  const totals = validateJournalPolicy(LEDGER_CURRENCY, sortedEntries);

  return Object.freeze({
    idempotencyKey: requiredText(input.idempotencyKey, "idempotencyKey", LEDGER_MAX_KEY_LENGTH),
    type: input.type,
    currency: LEDGER_CURRENCY,
    sourceReference: (() => {
      const ref = optionalText(input.sourceReference, "sourceReference", LEDGER_MAX_KEY_LENGTH, true);
      if (ref && !/^[A-Z0-9_-]+:[A-Z0-9_:-]+$/.test(ref)) {
        throw new LedgerError("LEDGER_SOURCE_REFERENCE_INVALID", "sourceReference must use a canonical namespaced format (e.g. namespace:identifier).");
      }
      return ref;
    })(),
    correlationId: optionalText(input.correlationId, "correlationId", LEDGER_MAX_KEY_LENGTH),
    memo: optionalText(input.memo, "memo", LEDGER_MAX_MEMO_LENGTH),
    metadata: sanitizeLedgerMetadata(input.metadata),
    actor: normalizeActor(input.actor),
    reversalOfJournalId: optionalText(input.reversalOfJournalId, "reversalOfJournalId", LEDGER_MAX_KEY_LENGTH),
    policyVersion: LEDGER_POLICY_VERSION,
    entries: sortedEntries,
    totalDebits: totals.totalDebits,
    totalCredits: totals.totalCredits,
  });
}
