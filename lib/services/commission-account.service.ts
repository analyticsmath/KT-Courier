import { prisma } from "@/lib/db/prisma";
import { ensureLedgerAccount, ensureWalletForOwner, getWalletAccount } from "./wallet-account.service";
import { CommissionError } from "@/lib/commissions/errors";

export async function ensurePlatformCommissionAccounts() {
  const wallet = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
  const revenue = await ensureLedgerAccount({ walletId: wallet.id, code: "PLATFORM-COMMISSION-REVENUE-ZAR", purpose: "PLATFORM_REVENUE", category: "REVENUE", currency: "ZAR" });
  const held = await getWalletAccount({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", purpose: "HELD" });
  return Object.freeze({ wallet, revenue, held });
}

export async function getPlatformCommissionAccounts() {
  const [revenue, held] = await Promise.all([
    getWalletAccount({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", purpose: "PLATFORM_REVENUE" }),
    getWalletAccount({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", purpose: "HELD" }),
  ]);
  return Object.freeze({ revenue, held });
}

/**
 * Internal provisioning only. It deliberately refuses to create a promoter
 * wallet: a later authorized promoter phase must establish that wallet first.
 */
export async function ensurePromoterCommissionPayableAccount(promoterId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { ownerType_ownerId_currency: { ownerType: "PROMOTER", ownerId: promoterId, currency: "ZAR" } } });
  if (!wallet || wallet.status !== "ACTIVE") throw new CommissionError("COMMISSION_ACCOUNT_INVALID", "A valid active promoter wallet is required before commission-payable provisioning.");
  return ensureLedgerAccount({ walletId: wallet.id, code: `PROMOTER-COMMISSION-PAYABLE-${wallet.id.toUpperCase()}`, purpose: "COMMISSION_PAYABLE", category: "LIABILITY", currency: "ZAR" });
}

export async function assertCommissionPayableAccount(input: Readonly<{ ownerId: string; walletId: string; accountId: string }>) {
  const account = await prisma.ledgerAccount.findUnique({ where: { id: input.accountId }, include: { wallet: true } });
  if (!account || account.id !== input.accountId || account.walletId !== input.walletId || account.wallet.ownerType !== "PROMOTER" || account.wallet.ownerId !== input.ownerId || account.wallet.currency !== "ZAR" || account.wallet.status !== "ACTIVE" || account.currency !== "ZAR" || account.status !== "ACTIVE" || account.purpose !== "COMMISSION_PAYABLE" || account.category !== "LIABILITY") {
    throw new CommissionError("COMMISSION_BENEFICIARY_INVALID", "The promoter beneficiary does not own an active ZAR commission-payable account.");
  }
  return Object.freeze({ id: account.id, walletId: account.walletId });
}
