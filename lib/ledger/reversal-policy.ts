import { LedgerError } from "./errors";
import type { LedgerPostingEntryInput } from "./types";

type ReversibleJournal = Readonly<{
  reversalOfJournalId: string | null;
  reversalJournal?: { id: string } | null;
  entries: readonly Readonly<{
    accountId: string;
    direction: "DEBIT" | "CREDIT";
    amount: { toFixed(decimalPlaces: number): string };
    lineCode: string;
    memo: string | null;
  }>[];
}>;

export function buildReversalEntries(journal: ReversibleJournal): LedgerPostingEntryInput[] {
  if (journal.reversalOfJournalId) {
    throw new LedgerError("LEDGER_REVERSAL_NOT_ALLOWED", "A reversal journal cannot itself be reversed in Phase 9.");
  }
  if (journal.reversalJournal) {
    throw new LedgerError("LEDGER_JOURNAL_ALREADY_REVERSED", "The ledger journal already has a direct reversal.");
  }

  return journal.entries.map((entry, index) => Object.freeze({
    accountId: entry.accountId,
    direction: entry.direction === "DEBIT" ? "CREDIT" : "DEBIT",
    amount: entry.amount.toFixed(2),
    lineCode: `REV-${index + 1}-${entry.lineCode}`.slice(0, 80),
    memo: entry.memo ? `Reversal: ${entry.memo}`.slice(0, 240) : "Reversal",
  }));
}
