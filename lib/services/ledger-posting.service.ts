import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertAccountCanPost } from "@/lib/ledger/account-policy";
import { calculateAccountProjection } from "@/lib/ledger/balance-policy";
import { LedgerError } from "@/lib/ledger/errors";
import { normalizeLedgerPosting } from "@/lib/ledger/posting-normalization";
import { hashLedgerPosting } from "@/lib/ledger/posting-hash";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { toLedgerAccountPolicySnapshot } from "@/lib/ledger/snapshots";
import type { PostLedgerJournalInput, SafeLedgerMetadata } from "@/lib/ledger/types";

const journalInclude = {
  entries: {
    orderBy: { sequence: "asc" as const },
    include: { account: { select: { id: true, code: true, purpose: true, category: true } } },
  },
  originalJournal: { select: { id: true, reference: true } },
  reversalJournal: { select: { id: true, reference: true } },
} satisfies Prisma.LedgerJournalInclude;

type JournalSnapshot = Prisma.LedgerJournalGetPayload<{ include: typeof journalInclude }>;

function postingDto(journal: JournalSnapshot) {
  return Object.freeze({
    id: journal.id,
    reference: journal.reference,
    type: journal.type,
    currency: journal.currency,
    idempotencyKey: journal.idempotencyKey,
    sourceReference: journal.sourceReference,
    correlationId: journal.correlationId,
    memo: journal.memo,
    metadata: journal.metadata as SafeLedgerMetadata | null,
    policyVersion: journal.policyVersion,
    totalDebits: journal.totalDebits.toFixed(2),
    totalCredits: journal.totalCredits.toFixed(2),
    balanced: journal.totalDebits.equals(journal.totalCredits),
    reversalOfJournal: journal.originalJournal,
    reversalJournal: journal.reversalJournal,
    postedAt: journal.postedAt.toISOString(),
    createdAt: journal.createdAt.toISOString(),
    entries: Object.freeze(journal.entries.map((entry) => Object.freeze({
      id: entry.id,
      sequence: entry.sequence,
      accountId: entry.accountId,
      accountCode: entry.account.code,
      accountPurpose: entry.account.purpose,
      accountCategory: entry.account.category,
      direction: entry.direction,
      amount: entry.amount.toFixed(2),
      lineCode: entry.lineCode,
      memo: entry.memo,
      createdAt: entry.createdAt.toISOString(),
    }))),
  });
}

function uniqueTarget(error: unknown): string[] {
  const target = (error as { meta?: { target?: unknown } })?.meta?.target;
  if (Array.isArray(target)) return target.map(String);
  return target === undefined ? [] : [String(target)];
}

async function resolveIdempotentReceipt(idempotencyKey: string, requestHash: string) {
  const existing = await prisma.ledgerJournal.findUnique({ where: { idempotencyKey }, include: journalInclude });
  if (!existing) return null;
  if (existing.requestHash !== requestHash) {
    throw new LedgerError("LEDGER_IDEMPOTENCY_CONFLICT", "The idempotency key is already associated with a different posting.");
  }
  return postingDto(existing);
}

async function assertPostingWalletOwner(
  tx: Prisma.TransactionClient,
  wallet: { ownerType: string; ownerId: string }
): Promise<void> {
  let exists = false;
  switch (wallet.ownerType) {
    case "CUSTOMER":
      exists = Boolean(await tx.user.findFirst({ where: { id: wallet.ownerId, role: "CUSTOMER" }, select: { id: true } }));
      break;
    case "STORE":
      exists = Boolean(await tx.store.findUnique({ where: { id: wallet.ownerId }, select: { id: true } }));
      break;
    case "DRIVER":
      exists = Boolean(await tx.driverProfile.findUnique({ where: { id: wallet.ownerId }, select: { id: true } }));
      break;
    case "PROMOTER":
      exists = Boolean(await tx.promoterProfile.findUnique({ where: { id: wallet.ownerId }, select: { id: true } }));
      break;
    case "PLATFORM":
      exists = wallet.ownerId === "platform";
      break;
  }
  if (!exists) throw new LedgerError("LEDGER_OWNER_INVALID", "A ledger account wallet has an invalid owner.");
}

async function assertReversalEvidence(
  tx: Prisma.TransactionClient,
  posting: ReturnType<typeof normalizeLedgerPosting>
): Promise<void> {
  if (!posting.reversalOfJournalId) return;
  const original = await tx.ledgerJournal.findUnique({
    where: { id: posting.reversalOfJournalId },
    include: {
      entries: { orderBy: { sequence: "asc" } },
      reversalJournal: { select: { id: true } },
    },
  });
  if (!original) throw new LedgerError("LEDGER_JOURNAL_NOT_FOUND", "The reversal original journal was not found.");
  if (original.reversalOfJournalId) {
    throw new LedgerError("LEDGER_REVERSAL_NOT_ALLOWED", "A reversal journal cannot itself be reversed in Phase 9.");
  }
  if (original.reversalJournal) {
    throw new LedgerError("LEDGER_JOURNAL_ALREADY_REVERSED", "The original journal already has a direct reversal.");
  }
  if (original.currency !== posting.currency || original.entries.length !== posting.entries.length) {
    throw new LedgerError("LEDGER_REVERSAL_NOT_ALLOWED", "Reversal evidence does not exactly match the original journal.");
  }

  const inverseByAccount = new Map(posting.entries.map((entry) => [entry.accountId, entry]));
  for (const entry of original.entries) {
    const inverse = inverseByAccount.get(entry.accountId);
    const expectedDirection = entry.direction === "DEBIT" ? "CREDIT" : "DEBIT";
    if (!inverse || inverse.direction !== expectedDirection || inverse.amount.toString() !== entry.amount.toFixed(2)) {
      throw new LedgerError("LEDGER_REVERSAL_NOT_ALLOWED", "Reversal entries must exactly invert original account directions and amounts.");
    }
  }
}

async function postNormalizedLedgerJournalWithinTransaction(
  tx: Prisma.TransactionClient,
  posting: ReturnType<typeof normalizeLedgerPosting>,
  requestHash: string,
  reference: string
) {
  const existing = await tx.ledgerJournal.findUnique({ where: { idempotencyKey: posting.idempotencyKey }, include: journalInclude });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new LedgerError("LEDGER_IDEMPOTENCY_CONFLICT", "The idempotency key is already associated with a different posting.");
    }
    return postingDto(existing);
  }

  if (posting.actor.kind === "USER") {
    const actor = await tx.user.findUnique({ where: { id: posting.actor.userId }, select: { id: true, status: true } });
    if (!actor || actor.status !== "ACTIVE") throw new LedgerError("LEDGER_OWNER_INVALID", "Ledger actor is invalid.");
  }

  await assertReversalEvidence(tx, posting);

  const accountIds = [...new Set(posting.entries.map((entry) => entry.accountId))].sort();
  const locked = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "LedgerAccount" WHERE "id" IN (${Prisma.join(accountIds)}) ORDER BY "id" ASC FOR UPDATE`
  );
  if (locked.length !== accountIds.length) {
    throw new LedgerError("LEDGER_ACCOUNT_NOT_FOUND", "One or more ledger accounts were not found.");
  }

  const accounts = await tx.ledgerAccount.findMany({
    where: { id: { in: accountIds } },
    include: { wallet: { select: { id: true, ownerType: true, ownerId: true, currency: true, status: true } } },
    orderBy: { id: "asc" },
  });

  const validatedWalletIds = new Set<string>();
  const projections: ReturnType<typeof calculateAccountProjection>[] = [];
  for (const account of accounts) {
    if (account.wallet.status !== "ACTIVE") throw new LedgerError("LEDGER_WALLET_INACTIVE", "A ledger account wallet is not active.");
    if (account.wallet.currency !== account.currency) {
      throw new LedgerError("LEDGER_ACCOUNT_CURRENCY_MISMATCH", "Ledger account and wallet currencies differ.");
    }
    if (!validatedWalletIds.has(account.wallet.id)) {
      await assertPostingWalletOwner(tx, account.wallet);
      validatedWalletIds.add(account.wallet.id);
    }
    const snapshot = toLedgerAccountPolicySnapshot(account);
    assertAccountCanPost(snapshot, posting.currency);
    projections.push(calculateAccountProjection(snapshot, posting.entries));
  }

  const journal = await tx.ledgerJournal.create({
    data: {
      reference,
      type: posting.type,
      currency: posting.currency,
      idempotencyKey: posting.idempotencyKey,
      requestHash,
      sourceReference: posting.sourceReference,
      correlationId: posting.correlationId,
      memo: posting.memo,
      metadata: posting.metadata as Prisma.InputJsonValue | undefined,
      policyVersion: posting.policyVersion,
      totalDebits: posting.totalDebits.toDecimal(),
      totalCredits: posting.totalCredits.toDecimal(),
      reversalOfJournalId: posting.reversalOfJournalId,
      createdByUserId: posting.actor.kind === "USER" ? posting.actor.userId : undefined,
    },
  });

  await tx.ledgerEntry.createMany({
    data: posting.entries.map((entry, index) => ({
      journalId: journal.id,
      accountId: entry.accountId,
      sequence: index + 1,
      direction: entry.direction,
      amount: entry.amount.toDecimal(),
      lineCode: entry.lineCode,
      memo: entry.memo,
    })),
  });

  const updatedAt = new Date();
  for (const projection of projections) {
    const update = await tx.ledgerAccount.updateMany({
      where: { id: projection.accountId, version: projection.expectedVersion },
      data: {
        currentBalance: projection.currentBalance.toDecimal(),
        debitTotal: projection.debitTotal.toDecimal(),
        creditTotal: projection.creditTotal.toDecimal(),
        version: { increment: 1 },
        updatedAt,
      },
    });
    if (update.count !== 1) {
      throw new LedgerError(
        "LEDGER_POSTING_CONCURRENCY_CONFLICT",
        "A ledger account changed during posting.",
        { retryable: true }
      );
    }
  }

  const committed = await tx.ledgerJournal.findUnique({ where: { id: journal.id }, include: journalInclude });
  if (!committed) throw new LedgerError("LEDGER_POSTING_CONCURRENCY_CONFLICT", "Posted journal could not be reloaded.");
  return postingDto(committed);
}

/**
 * Uses the caller's transaction. Callers must acquire non-ledger domain locks
 * before invoking this primitive; ledger account locks are always taken here
 * in sorted account-ID order.
 */
export async function postLedgerJournalWithinTransaction(
  tx: Prisma.TransactionClient,
  input: PostLedgerJournalInput,
) {
  const posting = normalizeLedgerPosting(input);
  const requestHash = hashLedgerPosting(posting);
  return postNormalizedLedgerJournalWithinTransaction(tx, posting, requestHash, `LJ-${randomUUID().toUpperCase()}`);
}

async function postInTransaction(
  posting: ReturnType<typeof normalizeLedgerPosting>,
  requestHash: string,
  reference: string,
) {
  return prisma.$transaction(
    (tx) => postNormalizedLedgerJournalWithinTransaction(tx, posting, requestHash, reference),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function postLedgerJournal(input: PostLedgerJournalInput) {
  const posting = normalizeLedgerPosting(input);
  const requestHash = hashLedgerPosting(posting);
  const reference = `LJ-${randomUUID().toUpperCase()}`;

  try {
    return await withLedgerRetry(() => postInTransaction(posting, requestHash, reference));
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      const receipt = await resolveIdempotentReceipt(posting.idempotencyKey, requestHash);
      if (receipt) return receipt;
      const targets = uniqueTarget(error);
      if (targets.some((target) => target.includes("sourceReference"))) {
        throw new LedgerError("LEDGER_SOURCE_REFERENCE_CONFLICT", "The source reference is already associated with another journal.");
      }
      if (targets.some((target) => target.includes("reversalOfJournalId"))) {
        throw new LedgerError("LEDGER_JOURNAL_ALREADY_REVERSED", "The original journal already has a direct reversal.");
      }
    }
    throw error;
  }
}
