import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LedgerError } from "@/lib/ledger/errors";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { ensureLedgerAccount } from "./wallet-account.service";
import type { WithdrawalOwnerType } from "@/lib/withdrawals/withdrawal-owner-policy";

function code(walletId: string, purpose: "OWNER_WITHDRAWABLE" | "WITHDRAWAL_HELD"): string {
  return `${purpose === "OWNER_WITHDRAWABLE" ? "OWN-WD" : "WD-HELD"}-${walletId}`.toUpperCase();
}

export async function ensureWithdrawalAccounts(input: Readonly<{
  walletId: string;
  ownerType: WithdrawalOwnerType;
}>): Promise<Readonly<{ sourceAccountId: string; heldAccountId: string }>> {
  const wallet = await prisma.wallet.findUnique({ where: { id: input.walletId }, select: { id: true, ownerType: true, status: true, currency: true } });
  if (!wallet || wallet.status !== "ACTIVE" || wallet.currency !== "ZAR" || wallet.ownerType !== input.ownerType) {
    throw new LedgerError("LEDGER_WALLET_INACTIVE", "A matching active owner wallet is required.");
  }
  const [source, held] = await Promise.all([
    ensureLedgerAccount({ walletId: wallet.id, code: code(wallet.id, "OWNER_WITHDRAWABLE"), purpose: "OWNER_WITHDRAWABLE", category: "LIABILITY", currency: "ZAR" }),
    ensureLedgerAccount({ walletId: wallet.id, code: code(wallet.id, "WITHDRAWAL_HELD"), purpose: "WITHDRAWAL_HELD", category: "LIABILITY", currency: "ZAR" }),
  ]);
  return Object.freeze({ sourceAccountId: source.id, heldAccountId: held.id });
}

export async function lockWithdrawalAccounts(
  tx: Prisma.TransactionClient,
  input: Readonly<{ walletId: string; sourceAccountId: string; heldAccountId: string }>,
) {
  const ids = [input.sourceAccountId, input.heldAccountId].sort();
  const locked = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "LedgerAccount" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" ASC FOR UPDATE`,
  );
  if (locked.length !== 2) throw new LedgerError("LEDGER_ACCOUNT_NOT_FOUND", "Withdrawal accounts were not found.");
  const accounts = await tx.ledgerAccount.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } });
  const source = accounts.find((account) => account.id === input.sourceAccountId);
  const held = accounts.find((account) => account.id === input.heldAccountId);
  if (!source || !held || source.walletId !== input.walletId || held.walletId !== input.walletId
    || source.purpose !== "OWNER_WITHDRAWABLE" || held.purpose !== "WITHDRAWAL_HELD"
    || source.category !== "LIABILITY" || held.category !== "LIABILITY"
    || source.status !== "ACTIVE" || held.status !== "ACTIVE" || source.allowNegative || held.allowNegative) {
    throw new LedgerError("LEDGER_OWNER_INVALID", "Withdrawal accounts do not meet the required policy.");
  }
  return { source, held };
}

export async function ensureWithdrawalAccountsWithinRetry(input: Readonly<{ walletId: string; ownerType: WithdrawalOwnerType }>) {
  return withLedgerRetry(() => ensureWithdrawalAccounts(input));
}
