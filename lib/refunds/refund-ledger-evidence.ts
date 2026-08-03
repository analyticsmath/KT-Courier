import { Prisma } from "@prisma/client";
import { RefundError } from "./errors";

export function assertRefundReserveJournalEvidence(input: Readonly<{
  refundAmount: string | Prisma.Decimal;
  heldAccountId: string;
  journal: Readonly<{
    type: string;
    currency: string;
    entries: readonly Readonly<{ accountId: string; direction: string; amount: string | Prisma.Decimal }>[];
  }> | null;
}>): void {
  const amount = new Prisma.Decimal(input.refundAmount);
  const journal = input.journal;
  if (!journal || journal.type !== "REFUND_RESERVE" || journal.currency !== "ZAR" || journal.entries.length < 2) {
    throw new RefundError("REFUND_LEDGER_INCOHERENT", "Refund reserve journal evidence is missing or invalid.");
  }
  const debit = journal.entries.filter((entry) => entry.direction === "DEBIT").reduce((sum, entry) => sum.add(entry.amount), new Prisma.Decimal(0));
  const credit = journal.entries.filter((entry) => entry.direction === "CREDIT").reduce((sum, entry) => sum.add(entry.amount), new Prisma.Decimal(0));
  const heldCredits = journal.entries.filter((entry) => entry.accountId === input.heldAccountId && entry.direction === "CREDIT" && new Prisma.Decimal(entry.amount).equals(amount));
  if (!debit.equals(amount) || !credit.equals(amount) || heldCredits.length !== 1) {
    throw new RefundError("REFUND_LEDGER_INCOHERENT", "Refund reserve journal does not hold the exact refund amount.");
  }
}
