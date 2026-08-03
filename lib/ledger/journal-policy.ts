import { LedgerError } from "./errors";
import { sumLedgerMoney } from "./money";
import type { LedgerCurrencyCode, NormalizedLedgerEntry } from "./types";

export function validateJournalPolicy(
  currency: LedgerCurrencyCode,
  entries: readonly NormalizedLedgerEntry[]
): { totalDebits: ReturnType<typeof sumLedgerMoney>; totalCredits: ReturnType<typeof sumLedgerMoney> } {
  if (entries.length < 2) {
    throw new LedgerError("LEDGER_INSUFFICIENT_ENTRIES", "A ledger journal requires at least two entries.");
  }

  const accounts = new Set(entries.map((entry) => entry.accountId));
  if (accounts.size < 2) {
    throw new LedgerError("LEDGER_INSUFFICIENT_ENTRIES", "A ledger journal requires at least two distinct accounts.");
  }

  const lineCodes = new Set<string>();
  const accountDirections = new Set<string>();
  const directionByAccount = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (entry.currency !== currency) {
      throw new LedgerError("LEDGER_ACCOUNT_CURRENCY_MISMATCH", "All journal lines must use the journal currency.");
    }
    if (lineCodes.has(entry.lineCode)) {
      throw new LedgerError("LEDGER_DUPLICATE_LINE_CODE", "Ledger line codes must be unique within a journal.");
    }
    lineCodes.add(entry.lineCode);

    const accountDirection = `${entry.accountId}:${entry.direction}`;
    if (accountDirections.has(accountDirection)) {
      throw new LedgerError("LEDGER_DUPLICATE_ACCOUNT_LINE", "Duplicate account and direction lines are not allowed.");
    }
    accountDirections.add(accountDirection);

    const directions = directionByAccount.get(entry.accountId) ?? new Set<string>();
    directions.add(entry.direction);
    directionByAccount.set(entry.accountId, directions);
    if (directions.size > 1) {
      throw new LedgerError("LEDGER_DUPLICATE_ACCOUNT_LINE", "The same account cannot appear on both sides of a Phase 9 journal.");
    }
  }

  const totalDebits = sumLedgerMoney(entries.filter((entry) => entry.direction === "DEBIT").map((entry) => entry.amount));
  const totalCredits = sumLedgerMoney(entries.filter((entry) => entry.direction === "CREDIT").map((entry) => entry.amount));
  if (totalDebits.isZero() || !totalDebits.equals(totalCredits)) {
    throw new LedgerError("LEDGER_UNBALANCED_JOURNAL", "Ledger journal debits and credits must be equal and greater than zero.");
  }

  return Object.freeze({ totalDebits, totalCredits });
}

