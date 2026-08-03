import { prisma } from "@/lib/db/prisma";
import { LedgerError } from "@/lib/ledger/errors";
import { buildReversalEntries } from "@/lib/ledger/reversal-policy";
import type { LedgerActor, SafeLedgerMetadata } from "@/lib/ledger/types";
import { postLedgerJournal } from "./ledger-posting.service";

export async function reverseLedgerJournal(input: Readonly<{
  originalJournalId: string;
  idempotencyKey: string;
  actor: LedgerActor;
  memo?: string;
  correlationId?: string;
  metadata?: SafeLedgerMetadata;
}>) {
  const original = await prisma.ledgerJournal.findUnique({
    where: { id: input.originalJournalId },
    include: {
      entries: { orderBy: { sequence: "asc" } },
      reversalJournal: { select: { id: true, idempotencyKey: true } },
    },
  });
  if (!original) throw new LedgerError("LEDGER_JOURNAL_NOT_FOUND", "Ledger journal was not found.");

  const isIdempotentReplay = original.reversalJournal?.idempotencyKey === input.idempotencyKey;
  const entries = buildReversalEntries({
    ...original,
    reversalJournal: isIdempotentReplay ? null : original.reversalJournal,
  });
  return postLedgerJournal({
    idempotencyKey: input.idempotencyKey,
    type: "REVERSAL",
    currency: original.currency,
    sourceReference: `REVERSAL:${original.reference}`,
    correlationId: input.correlationId ?? original.correlationId ?? undefined,
    memo: input.memo ?? `Reversal of ${original.reference}`,
    metadata: input.metadata ?? { originalJournalReference: original.reference },
    actor: input.actor,
    reversalOfJournalId: original.id,
    entries,
  });
}
