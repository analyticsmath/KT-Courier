import { Prisma } from "@prisma/client";
import { LedgerError } from "@/lib/ledger/errors";
import { ensureLedgerAccountInTx } from "@/lib/services/wallet-account.service";
import {
  isQaSandboxPlatformAccountCode,
  QA_ACCEPTANCE_PLATFORM_ACCOUNTS,
  QA_ACCEPTANCE_PLATFORM_OWNER_ID,
} from "./config";

export function platformWalletOwnerIdForIsolation(isQaIsolated: boolean): string {
  return isQaIsolated ? QA_ACCEPTANCE_PLATFORM_OWNER_ID : "platform";
}

export function platformCashClearingCodeForIsolation(isQaIsolated: boolean): string {
  return isQaIsolated
    ? QA_ACCEPTANCE_PLATFORM_ACCOUNTS.cashClearingCode
    : "PLATFORM-CASH-CLEARING-ZAR";
}

export function platformFundsHeldCodeForIsolation(isQaIsolated: boolean): string {
  return isQaIsolated
    ? QA_ACCEPTANCE_PLATFORM_ACCOUNTS.fundsHeldCode
    : "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR";
}

export function platformAdjustmentCodeForIsolation(isQaIsolated: boolean): string {
  return isQaIsolated
    ? QA_ACCEPTANCE_PLATFORM_ACCOUNTS.adjustmentCode
    : "PLATFORM-ADJUSTMENT-ZAR";
}

export function platformCodShortageCodeForIsolation(isQaIsolated: boolean): string {
  return isQaIsolated
    ? QA_ACCEPTANCE_PLATFORM_ACCOUNTS.codShortageSuspenseCode
    : "PLATFORM-CASH-SHORT-OVER-SUSPENSE-ZAR";
}

export async function ensureQaPlatformSandboxAccountsInTx(tx: Prisma.TransactionClient) {
  let wallet = await tx.wallet.findUnique({
    where: {
      ownerType_ownerId_currency: {
        ownerType: "PLATFORM",
        ownerId: QA_ACCEPTANCE_PLATFORM_OWNER_ID,
        currency: "ZAR",
      },
    },
  });

  if (!wallet) {
    wallet = await tx.wallet.create({
      data: {
        ownerType: "PLATFORM",
        ownerId: QA_ACCEPTANCE_PLATFORM_OWNER_ID,
        currency: "ZAR",
        status: "ACTIVE",
        isQaIsolated: true,
      },
    });
  } else {
    if (wallet.status !== "ACTIVE") {
      throw new LedgerError("LEDGER_WALLET_INACTIVE", "QA sandbox platform wallet is not active.");
    }
    if (!wallet.isQaIsolated) {
      wallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { isQaIsolated: true },
      });
    }
  }

  const [cashClearing, fundsHeld, commissionRevenue, adjustment, codShortageSuspense] = await Promise.all([
    ensureLedgerAccountInTx(tx, {
      walletId: wallet.id,
      code: QA_ACCEPTANCE_PLATFORM_ACCOUNTS.cashClearingCode,
      purpose: "CASH_CLEARING",
      category: "ASSET",
      currency: "ZAR",
      allowNegative: true,
    }),
    ensureLedgerAccountInTx(tx, {
      walletId: wallet.id,
      code: QA_ACCEPTANCE_PLATFORM_ACCOUNTS.fundsHeldCode,
      purpose: "HELD",
      category: "LIABILITY",
      currency: "ZAR",
      allowNegative: false,
    }),
    ensureLedgerAccountInTx(tx, {
      walletId: wallet.id,
      code: QA_ACCEPTANCE_PLATFORM_ACCOUNTS.commissionRevenueCode,
      purpose: "PLATFORM_REVENUE",
      category: "REVENUE",
      currency: "ZAR",
      allowNegative: false,
    }),
    ensureLedgerAccountInTx(tx, {
      walletId: wallet.id,
      code: QA_ACCEPTANCE_PLATFORM_ACCOUNTS.adjustmentCode,
      purpose: "ADJUSTMENT",
      category: "EQUITY",
      currency: "ZAR",
      allowNegative: true,
    }),
    ensureLedgerAccountInTx(tx, {
      walletId: wallet.id,
      code: QA_ACCEPTANCE_PLATFORM_ACCOUNTS.codShortageSuspenseCode,
      purpose: "COD_SHORTAGE_SUSPENSE",
      category: "EXPENSE",
      currency: "ZAR",
      allowNegative: false,
    }),
  ]);

  return Object.freeze({
    wallet,
    cashClearing,
    fundsHeld,
    commissionRevenue,
    adjustment,
    codShortageSuspense,
  });
}

/**
 * Ensures an owner (STORE, DRIVER, or CUSTOMER) wallet can safely be marked
 * as QA-isolated without contaminating live commercial financial history.
 */
export async function ensureOwnerWalletIsolatedForQaInTx(
  tx: Prisma.TransactionClient,
  input: Readonly<{
    ownerType: "STORE" | "DRIVER" | "CUSTOMER";
    ownerId: string;
  }>,
) {
  const existing = await tx.wallet.findUnique({
    where: {
      ownerType_ownerId_currency: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        currency: "ZAR",
      },
    },
    include: { accounts: { select: { id: true, currentBalance: true } } },
  });

  if (!existing) {
    return tx.wallet.create({
      data: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        currency: "ZAR",
        status: "ACTIVE",
        isQaIsolated: true,
      },
    });
  }

  if (existing.status !== "ACTIVE") {
    throw new LedgerError("LEDGER_WALLET_INACTIVE", "Owner wallet is inactive.");
  }

  if (existing.isQaIsolated) {
    return existing;
  }

  const accountIds = existing.accounts.map((a) => a.id);
  const hasNonZeroBalance = existing.accounts.some((a) => !a.currentBalance.isZero());
  const existingEntriesCount =
    accountIds.length > 0
      ? await tx.ledgerEntry.count({ where: { accountId: { in: accountIds } } })
      : 0;

  if (hasNonZeroBalance || existingEntriesCount > 0) {
    throw new LedgerError(
      "LEDGER_NAMESPACE_ISOLATION_VIOLATION",
      `${input.ownerType} wallet ${input.ownerId} already holds live commercial ledger history and cannot be converted into an isolated QA wallet.`,
    );
  }

  return tx.wallet.update({
    where: { id: existing.id },
    data: { isQaIsolated: true },
  });
}

export function assertLedgerPostingNamespaceIsolation(
  accounts: readonly Readonly<{
    code: string;
    wallet: Readonly<{
      ownerType: string;
      ownerId: string;
      isQaIsolated?: boolean;
    }>;
  }>[],
): void {
  const isAccountQaSandbox = (account: (typeof accounts)[number]) =>
    Boolean(account?.wallet?.isQaIsolated) ||
    (account?.wallet?.ownerType === "PLATFORM" &&
      account?.wallet?.ownerId === QA_ACCEPTANCE_PLATFORM_OWNER_ID) ||
    isQaSandboxPlatformAccountCode(account?.code);

  const anyQa = accounts.some(isAccountQaSandbox);
  if (!anyQa) return;

  const allAllowedInQaNamespace = accounts.every((account) => {
    if (account.wallet.ownerType === "PLATFORM") {
      return (
        account.wallet.ownerId === QA_ACCEPTANCE_PLATFORM_OWNER_ID &&
        isQaSandboxPlatformAccountCode(account.code)
      );
    }
    return Boolean(account.wallet.isQaIsolated);
  });

  if (!allAllowedInQaNamespace) {
    throw new LedgerError(
      "LEDGER_NAMESPACE_ISOLATION_VIOLATION",
      "QA acceptance and sandbox ledger accounts must remain strictly isolated from live commercial accounts.",
    );
  }
}
