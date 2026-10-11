import type { Prisma } from "@prisma/client";
import { ensureLedgerAccount, ensureWalletForOwner } from "./wallet-account.service";

export const GUEST_REFUND_HELD_CODE = "PLATFORM-GUEST-REFUND-HELD-ZAR";

/** Guest reservations must leave the original source liability. They never
 * select an unrelated customer's wallet through an undefined owner filter. */
export async function ensureGuestRefundHeldAccount() {
  const wallet = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
  return ensureLedgerAccount({ walletId: wallet.id, code: GUEST_REFUND_HELD_CODE, purpose: "CUSTOMER_REFUND_HELD", category: "LIABILITY", currency: "ZAR" });
}

export async function resolveRefundHeldAccount(tx: Prisma.TransactionClient, customerUserId: string | null) {
  return tx.ledgerAccount.findFirst({ where: {
    ...(customerUserId ? {} : { code: GUEST_REFUND_HELD_CODE }),
    purpose: "CUSTOMER_REFUND_HELD", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", allowNegative: false,
    wallet: { ownerType: customerUserId ? "CUSTOMER" : "PLATFORM", ownerId: customerUserId ?? "platform", currency: "ZAR", status: "ACTIVE" },
  } });
}
