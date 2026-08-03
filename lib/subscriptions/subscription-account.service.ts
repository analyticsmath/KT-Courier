import { ensureLedgerAccount, ensureWalletForOwner, getWalletAccount } from "@/lib/services/wallet-account.service";

/** Provisioning is an explicit operational step, never a side effect inside a payment settlement transaction. */
export async function ensurePlatformSubscriptionAccounts() {
  const wallet = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
  const [held, deferredRevenue, revenue, taxPayable] = await Promise.all([
    getWalletAccount({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", purpose: "HELD" }),
    ensureLedgerAccount({ walletId: wallet.id, code: "PLATFORM-SUBSCRIPTION-DEFERRED-REVENUE-ZAR", purpose: "SUBSCRIPTION_DEFERRED_REVENUE", category: "LIABILITY", currency: "ZAR" }),
    ensureLedgerAccount({ walletId: wallet.id, code: "PLATFORM-SUBSCRIPTION-REVENUE-ZAR", purpose: "PLATFORM_REVENUE", category: "REVENUE", currency: "ZAR" }),
    ensureLedgerAccount({ walletId: wallet.id, code: "PLATFORM-SUBSCRIPTION-TAX-PAYABLE-ZAR", purpose: "SUBSCRIPTION_TAX_PAYABLE", category: "LIABILITY", currency: "ZAR" }),
  ]);
  return Object.freeze({ wallet, held, deferredRevenue, revenue, taxPayable });
}
