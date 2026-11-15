import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ensureLedgerAccount, ensureLedgerAccountInTx, ensureWalletForOwner, ensureWalletForOwnerInTx } from "./wallet-account.service";
import { ensureWalletAvailableAccountInTx } from "./wallet-spending.service";

export const GUEST_REFUND_HELD_CODE = "PLATFORM-GUEST-REFUND-HELD-ZAR";

function storeRefundHeldCode(storeId: string): string {
  const hash = createHash("sha256").update(storeId, "utf8").digest("hex").slice(0, 24).toUpperCase();
  return `STORE-${hash}-REFUND-HELD-ZAR`;
}

export async function ensureStoreRefundHeldAccountsInTx(
  tx: Prisma.TransactionClient,
  storeId: string,
) {
  const wallet = await ensureWalletForOwnerInTx(tx, {
    ownerType: "STORE",
    ownerId: storeId,
    currency: "ZAR",
  });
  const available = await ensureWalletAvailableAccountInTx(tx, {
    ownerType: "STORE",
    ownerId: storeId,
  });
  const existingHeld = await tx.ledgerAccount.findUnique({
    where: {
      walletId_purpose_currency: {
        walletId: wallet.id,
        purpose: "CUSTOMER_REFUND_HELD",
        currency: "ZAR",
      },
    },
  });
  const held = existingHeld
    ? existingHeld
    : await ensureLedgerAccountInTx(tx, {
        walletId: wallet.id,
        code: storeRefundHeldCode(storeId),
        purpose: "CUSTOMER_REFUND_HELD",
        category: "LIABILITY",
        currency: "ZAR",
      });
  return { wallet, available, held };
}

/** Guest reservations must leave the original source liability. They never
 * select an unrelated customer's wallet through an undefined owner filter. */
export async function ensureGuestRefundHeldAccount() {
  const wallet = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
  return ensureLedgerAccount({ walletId: wallet.id, code: GUEST_REFUND_HELD_CODE, purpose: "CUSTOMER_REFUND_HELD", category: "LIABILITY", currency: "ZAR" });
}

export async function resolveRefundHeldAccount(
  tx: Prisma.TransactionClient,
  customerUserId: string | null,
  beneficiaryStoreId?: string | null,
) {
  if (beneficiaryStoreId) {
    return tx.ledgerAccount.findFirst({
      where: {
        purpose: "CUSTOMER_REFUND_HELD",
        category: "LIABILITY",
        currency: "ZAR",
        status: "ACTIVE",
        allowNegative: false,
        wallet: {
          ownerType: "STORE",
          ownerId: beneficiaryStoreId,
          currency: "ZAR",
          status: "ACTIVE",
        },
      },
    });
  }
  return tx.ledgerAccount.findFirst({ where: {
    ...(customerUserId ? {} : { code: GUEST_REFUND_HELD_CODE }),
    purpose: "CUSTOMER_REFUND_HELD", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", allowNegative: false,
    wallet: { ownerType: customerUserId ? "CUSTOMER" : "PLATFORM", ownerId: customerUserId ?? "platform", currency: "ZAR", status: "ACTIVE" },
  } });
}
