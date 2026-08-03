import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { StoreEarningError } from "@/lib/store-earnings/errors";
import { ensureLedgerAccount } from "./wallet-account.service";

function payableCode(walletId: string): string {
  return `STORE-EARNINGS-PAYABLE-${walletId}`.toUpperCase();
}

export async function ensureStoreEarningPayableAccount(storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, status: true } });
  if (!store || store.status !== "ACTIVE") throw new StoreEarningError("STORE_EARNING_ACCOUNT_INVALID", "An active approved store is required for store earning account provisioning.");
  const wallet = await prisma.wallet.findUnique({ where: { ownerType_ownerId_currency: { ownerType: "STORE", ownerId: store.id, currency: "ZAR" } } });
  if (!wallet || wallet.status !== "ACTIVE" || wallet.currency !== "ZAR") throw new StoreEarningError("STORE_EARNING_ACCOUNT_INVALID", "The canonical active store wallet must exist before store earning account provisioning.");
  const account = await ensureLedgerAccount({ walletId: wallet.id, code: payableCode(wallet.id), purpose: "STORE_EARNINGS_PAYABLE", category: "LIABILITY", currency: "ZAR" });
  if (account.allowNegative || (account.currentBalance !== "0.00" && account.debitTotal === "0.00" && account.creditTotal === "0.00")) {
    throw new StoreEarningError("STORE_EARNING_ACCOUNT_INVALID", "Store earning payable account opening evidence is invalid.");
  }
  return Object.freeze({ wallet, account });
}

export async function resolveStoreEarningPayableAccountWithinTransaction(tx: Prisma.TransactionClient, input: Readonly<{ storeId: string; walletId: string; accountId?: string }>) {
  const wallet = await tx.wallet.findUnique({ where: { id: input.walletId }, include: { accounts: { where: { purpose: "STORE_EARNINGS_PAYABLE", currency: "ZAR" }, take: 1 } } });
  const account = wallet?.accounts[0];
  if (!wallet || wallet.ownerType !== "STORE" || wallet.ownerId !== input.storeId || wallet.currency !== "ZAR" || wallet.status !== "ACTIVE" || !account || (input.accountId && account.id !== input.accountId) || account.category !== "LIABILITY" || account.status !== "ACTIVE" || account.allowNegative) {
    throw new StoreEarningError("STORE_EARNING_ACCOUNT_INVALID", "Canonical store earning payable account evidence is invalid.");
  }
  return Object.freeze({ wallet, account });
}
