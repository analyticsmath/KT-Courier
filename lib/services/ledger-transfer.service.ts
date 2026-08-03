import { LedgerError } from "@/lib/ledger/errors";
import type {
  LedgerAccountPurposeCode,
  LedgerActor,
  SafeLedgerMetadata,
} from "@/lib/ledger/types";
import { prisma } from "@/lib/db/prisma";
import { postLedgerJournal } from "./ledger-posting.service";

export async function transferBetweenLedgerAccounts(input: Readonly<{
  idempotencyKey: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: string;
  debitLineCode: string;
  creditLineCode: string;
  sourceReference?: string;
  correlationId?: string;
  memo?: string;
  metadata?: SafeLedgerMetadata;
  actor: LedgerActor;
  expectedDebitPurpose?: LedgerAccountPurposeCode;
  expectedCreditPurpose?: LedgerAccountPurposeCode;
}>) {
  if (input.debitAccountId === input.creditAccountId) {
    throw new LedgerError("LEDGER_DUPLICATE_ACCOUNT_LINE", "A ledger transfer requires two different accounts.");
  }

  if (input.expectedDebitPurpose || input.expectedCreditPurpose) {
    const accounts = await prisma.ledgerAccount.findMany({
      where: { id: { in: [input.debitAccountId, input.creditAccountId] } },
      select: { id: true, purpose: true },
    });
    const byId = new Map(accounts.map((account) => [account.id, account]));
    if (accounts.length !== 2) throw new LedgerError("LEDGER_ACCOUNT_NOT_FOUND", "A transfer account was not found.");
    if (input.expectedDebitPurpose && byId.get(input.debitAccountId)?.purpose !== input.expectedDebitPurpose) {
      throw new LedgerError("LEDGER_OWNER_INVALID", "Debit account purpose does not match the transfer policy.");
    }
    if (input.expectedCreditPurpose && byId.get(input.creditAccountId)?.purpose !== input.expectedCreditPurpose) {
      throw new LedgerError("LEDGER_OWNER_INVALID", "Credit account purpose does not match the transfer policy.");
    }
  }

  return postLedgerJournal({
    idempotencyKey: input.idempotencyKey,
    type: "ACCOUNT_TRANSFER",
    currency: "ZAR",
    sourceReference: input.sourceReference,
    correlationId: input.correlationId,
    memo: input.memo,
    metadata: input.metadata,
    actor: input.actor,
    entries: [
      {
        accountId: input.debitAccountId,
        direction: "DEBIT",
        amount: input.amount,
        lineCode: input.debitLineCode,
        memo: input.memo,
      },
      {
        accountId: input.creditAccountId,
        direction: "CREDIT",
        amount: input.amount,
        lineCode: input.creditLineCode,
        memo: input.memo,
      },
    ],
  });
}

