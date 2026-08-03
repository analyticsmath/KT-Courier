import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LedgerError } from "@/lib/ledger/errors";
import { withLedgerRetry } from "@/lib/ledger/retry";
import type {
  LedgerAccountCategoryCode,
  LedgerAccountPurposeCode,
  LedgerCurrencyCode,
  LedgerOwnerTypeCode,
} from "@/lib/ledger/types";

type EnsureWalletInput = Readonly<{
  ownerType: LedgerOwnerTypeCode;
  ownerId: string;
  currency: LedgerCurrencyCode;
}>;

type EnsureAccountInput = Readonly<{
  walletId: string;
  code: string;
  purpose: LedgerAccountPurposeCode;
  category: LedgerAccountCategoryCode;
  currency: LedgerCurrencyCode;
}>;

function isUniqueConflict(error: unknown): boolean {
  return (error as { code?: string })?.code === "P2002";
}

async function assertOwnerExists(tx: Prisma.TransactionClient, input: EnsureWalletInput): Promise<void> {
  let exists = false;
  switch (input.ownerType) {
    case "CUSTOMER":
      exists = Boolean(await tx.user.findFirst({ where: { id: input.ownerId, role: "CUSTOMER" }, select: { id: true } }));
      break;
    case "STORE":
      exists = Boolean(await tx.store.findUnique({ where: { id: input.ownerId }, select: { id: true } }));
      break;
    case "DRIVER":
      exists = Boolean(await tx.driverProfile.findUnique({ where: { id: input.ownerId }, select: { id: true } }));
      break;
    case "PROMOTER":
      exists = Boolean(await tx.promoterAccount.findUnique({ where: { id: input.ownerId }, select: { id: true } }));
      break;
    case "PLATFORM":
      exists = input.ownerId === "platform";
      break;
  }
  if (!exists) throw new LedgerError("LEDGER_OWNER_INVALID", "Ledger wallet owner is invalid.");
}

function walletSnapshot(wallet: {
  id: string;
  ownerType: string;
  ownerId: string;
  currency: string;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return Object.freeze({ ...wallet });
}

function accountSnapshot(account: {
  id: string;
  walletId: string;
  code: string;
  purpose: string;
  category: string;
  currency: string;
  status: string;
  allowNegative: boolean;
  currentBalance: Prisma.Decimal;
  debitTotal: Prisma.Decimal;
  creditTotal: Prisma.Decimal;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return Object.freeze({
    ...account,
    currentBalance: account.currentBalance.toFixed(2),
    debitTotal: account.debitTotal.toFixed(2),
    creditTotal: account.creditTotal.toFixed(2),
  });
}

export async function ensureWalletForOwner(input: EnsureWalletInput) {
  if (input.currency !== "ZAR" || !input.ownerId.trim()) {
    throw new LedgerError("LEDGER_OWNER_INVALID", "A valid owner and ZAR currency are required.");
  }

  try {
    const wallet = await withLedgerRetry(() => prisma.$transaction(async (tx) => {
      await assertOwnerExists(tx, input);
      const existing = await tx.wallet.findUnique({
        where: { ownerType_ownerId_currency: input },
      });
      if (existing) {
        if (existing.status !== "ACTIVE") {
          throw new LedgerError("LEDGER_WALLET_INACTIVE", "Ledger wallet is not active.");
        }
        return existing;
      }

      return tx.wallet.create({
        data: {
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          currency: input.currency,
          status: "ACTIVE",
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    return walletSnapshot(wallet);
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const winner = await prisma.wallet.findUnique({ where: { ownerType_ownerId_currency: input } });
    if (!winner) throw error;
    if (winner.status !== "ACTIVE") throw new LedgerError("LEDGER_WALLET_INACTIVE", "Ledger wallet is not active.");
    return walletSnapshot(winner);
  }
}

export async function ensureLedgerAccount(input: EnsureAccountInput) {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,79}$/.test(code) || input.currency !== "ZAR") {
    throw new LedgerError("LEDGER_OWNER_INVALID", "Ledger account code or currency is invalid.");
  }

  const resolve = async () => withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { id: input.walletId } });
    if (!wallet) throw new LedgerError("LEDGER_WALLET_NOT_FOUND", "Ledger wallet was not found.");
    if (wallet.status !== "ACTIVE") throw new LedgerError("LEDGER_WALLET_INACTIVE", "Ledger wallet is not active.");
    if (wallet.currency !== input.currency) {
      throw new LedgerError("LEDGER_ACCOUNT_CURRENCY_MISMATCH", "Ledger account currency does not match its wallet.");
    }

    const existingByPurpose = await tx.ledgerAccount.findUnique({
      where: { walletId_purpose_currency: { walletId: input.walletId, purpose: input.purpose, currency: input.currency } },
    });
    if (existingByPurpose) {
      if (existingByPurpose.code !== code || existingByPurpose.category !== input.category) {
        throw new LedgerError("LEDGER_OWNER_INVALID", "Existing wallet account conflicts with the requested canonical definition.");
      }
      return existingByPurpose;
    }

    const existingByCode = await tx.ledgerAccount.findUnique({ where: { code } });
    if (existingByCode) {
      throw new LedgerError("LEDGER_OWNER_INVALID", "Ledger account code is already assigned to another account.");
    }

    return tx.ledgerAccount.create({
      data: {
        walletId: input.walletId,
        code,
        purpose: input.purpose,
        category: input.category,
        currency: input.currency,
        allowNegative: false,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

  try {
    return accountSnapshot(await resolve());
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const winner = await prisma.ledgerAccount.findUnique({
      where: { walletId_purpose_currency: { walletId: input.walletId, purpose: input.purpose, currency: input.currency } },
    });
    if (!winner || winner.code !== code || winner.category !== input.category) throw error;
    return accountSnapshot(winner);
  }
}

export async function getWalletAccount(args: {
  ownerType: LedgerOwnerTypeCode;
  ownerId: string;
  currency: LedgerCurrencyCode;
  purpose: LedgerAccountPurposeCode;
}) {
  const wallet = await prisma.wallet.findUnique({
    where: { ownerType_ownerId_currency: { ownerType: args.ownerType, ownerId: args.ownerId, currency: args.currency } },
    include: { accounts: { where: { purpose: args.purpose, currency: args.currency }, take: 1 } },
  });
  if (!wallet) throw new LedgerError("LEDGER_WALLET_NOT_FOUND", "Ledger wallet was not found.");
  if (wallet.status !== "ACTIVE") throw new LedgerError("LEDGER_WALLET_INACTIVE", "Ledger wallet is not active.");
  const account = wallet.accounts[0];
  if (!account) throw new LedgerError("LEDGER_ACCOUNT_NOT_FOUND", "Ledger account was not found.");
  return accountSnapshot(account);
}
