import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { ensureLedgerAccountInTx, ensureWalletForOwnerInTx } from "@/lib/services/wallet-account.service";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { PROMOTION_ACCOUNT_CODES } from "@/lib/promotions/promotion-ledger-policy";
import { AdminWalletGrantError, validateAdminWalletGrant } from "./admin-customer-wallet-grant-policy";

/**
 * Owner-funded grants are a platform marketing expense and nonwithdrawable
 * customer liability. No provider receipt or customer bank deposit is implied.
 * The immutable journal is also the actor/amount/reason/idempotency audit.
 */
export async function creditCustomerWalletBySuperAdmin(input: Readonly<{
  actorUserId: string;
  customerUserId: string;
  amount: string;
  reason: string;
  operationId: string;
}>) {
  const grant = validateAdminWalletGrant({ amount: input.amount, reason: input.reason, operationId: input.operationId });
  if (!input.actorUserId || !input.customerUserId || input.actorUserId === input.customerUserId) {
    throw new AdminWalletGrantError("UNAUTHORIZED", "A distinct superuser and customer are required.");
  }
  // A globally unique operation ID may fund one customer only. Reusing it
  // for a different recipient/amount/reason is an idempotency conflict.
  const operationHash = createHash("sha256").update(grant.operationId).digest("hex").toUpperCase();
  const customerCode = `CUSTOMER-${createHash("sha256").update(input.customerUserId).digest("hex").slice(0, 24).toUpperCase()}-WALLET-ZAR`;
  const idempotencyKey = `admin-wallet-grant-${operationHash}`;
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${input.customerUserId} FOR UPDATE`,
    );
    if (locked.length !== 1) {
      throw new AdminWalletGrantError("CUSTOMER_NOT_FOUND", "The customer account was not found.");
    }
    const [actor, recipient] = await Promise.all([
      tx.user.findUnique({ where: { id: input.actorUserId }, select: { role: true, status: true } }),
      tx.user.findUnique({ where: { id: input.customerUserId }, select: { role: true, status: true } }),
    ]);
    if (!actor || actor.role !== "SUPER_ADMIN" || actor.status !== "ACTIVE") {
      throw new AdminWalletGrantError("UNAUTHORIZED", "Only an active superuser may fund a customer wallet.");
    }
    if (!recipient || recipient.role !== "CUSTOMER" || recipient.status !== "ACTIVE") {
      throw new AdminWalletGrantError("CUSTOMER_NOT_FOUND", "An active customer account is required.");
    }
    const customerWallet = await ensureWalletForOwnerInTx(tx, {
      ownerType: "CUSTOMER", ownerId: input.customerUserId, currency: "ZAR",
    });
    const available = await ensureLedgerAccountInTx(tx, {
      walletId: customerWallet.id, code: customerCode,
      purpose: "CUSTOMER_WALLET_AVAILABLE", category: "LIABILITY", currency: "ZAR",
    });
    const platformWallet = await ensureWalletForOwnerInTx(tx, {
      ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR",
    });
    const marketingExpense = await ensureLedgerAccountInTx(tx, {
      walletId: platformWallet.id, code: PROMOTION_ACCOUNT_CODES.PLATFORM_EXPENSE,
      purpose: "PLATFORM_PROMOTION_EXPENSE", category: "EXPENSE", currency: "ZAR",
    });
    const existed = await tx.ledgerJournal.findUnique({
      where: { idempotencyKey }, select: { id: true },
    });
    const journal = await postLedgerJournalWithinTransaction(tx, {
      idempotencyKey,
      type: "GENERAL",
      currency: "ZAR",
      sourceReference: `ADMIN_WALLET_GRANT:${operationHash}`,
      correlationId: grant.operationId,
      actor: { kind: "USER", userId: input.actorUserId },
      memo: `Superuser-funded customer wallet grant: ${grant.reason}`,
      metadata: {
        category: "ADMIN_CUSTOMER_WALLET_GRANT",
        reason: grant.reason,
        customerUserId: input.customerUserId,
        actorUserId: input.actorUserId,
        funding: "PLATFORM_PROMOTION_EXPENSE",
      },
      entries: [
        { accountId: marketingExpense.id, direction: "DEBIT", amount: grant.amount, lineCode: "PLATFORM-GRANT-EXPENSE" },
        { accountId: available.id, direction: "CREDIT", amount: grant.amount, lineCode: "CUSTOMER-GRANT-CREDIT" },
      ],
    });
    const projection = await tx.ledgerAccount.findUniqueOrThrow({
      where: { id: available.id }, select: { currentBalance: true },
    });
    return Object.freeze({
      journalReference: journal.reference,
      journalId: journal.id,
      customerUserId: input.customerUserId,
      amount: grant.amount,
      availableBalanceAfter: projection.currentBalance.toFixed(2),
      status: existed ? "REPLAYED" as const : "CREDITED" as const,
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 }));
}
