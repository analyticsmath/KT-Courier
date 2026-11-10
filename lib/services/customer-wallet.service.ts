import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { RefundError } from "@/lib/refunds/errors";
import {
  ensureLedgerAccount,
  ensureLedgerAccountInTx,
  ensureWalletForOwner,
  ensureWalletForOwnerInTx,
} from "./wallet-account.service";

export function customerAccountPrefix(userId: string): string {
  return `CUSTOMER-${createHash("sha256").update(userId).digest("hex").slice(0, 24).toUpperCase()}`;
}

export async function ensureCustomerRefundWallet(customerUserId: string) {
  const customer = await prisma.user.findFirst({ where: { id: customerUserId, role: "CUSTOMER", status: "ACTIVE" }, select: { id: true } });
  if (!customer) throw new Error("Active customer is required for customer wallet provisioning.");
  const wallet = await ensureWalletForOwner({ ownerType: "CUSTOMER", ownerId: customerUserId, currency: "ZAR" });
  const prefix = customerAccountPrefix(customerUserId);
  const [available, reserved, refundHeld] = await Promise.all([
    ensureLedgerAccount({ walletId: wallet.id, code: `${prefix}-WALLET-ZAR`, purpose: "CUSTOMER_WALLET_AVAILABLE", category: "LIABILITY", currency: "ZAR" }),
    ensureLedgerAccount({ walletId: wallet.id, code: `${prefix}-WALLET-RESERVED-ZAR`, purpose: "HELD", category: "LIABILITY", currency: "ZAR" }),
    ensureLedgerAccount({ walletId: wallet.id, code: `${prefix}-REFUND-HELD-ZAR`, purpose: "CUSTOMER_REFUND_HELD", category: "LIABILITY", currency: "ZAR" }),
  ]);
  return Object.freeze({ wallet, available, reserved, refundHeld });
}

export async function ensureCustomerWalletAccountsInTx(
  tx: Prisma.TransactionClient,
  customerUserId: string,
) {
  const wallet = await ensureWalletForOwnerInTx(tx, {
    ownerType: "CUSTOMER",
    ownerId: customerUserId,
    currency: "ZAR",
  });
  const prefix = customerAccountPrefix(customerUserId);
  const available = await ensureLedgerAccountInTx(tx, {
    walletId: wallet.id,
    code: `${prefix}-WALLET-ZAR`,
    purpose: "CUSTOMER_WALLET_AVAILABLE",
    category: "LIABILITY",
    currency: "ZAR",
  });
  const reserved = await ensureLedgerAccountInTx(tx, {
    walletId: wallet.id,
    code: `${prefix}-WALLET-RESERVED-ZAR`,
    purpose: "HELD",
    category: "LIABILITY",
    currency: "ZAR",
  });
  const refundHeld = await ensureLedgerAccountInTx(tx, {
    walletId: wallet.id,
    code: `${prefix}-REFUND-HELD-ZAR`,
    purpose: "CUSTOMER_REFUND_HELD",
    category: "LIABILITY",
    currency: "ZAR",
  });
  return Object.freeze({ wallet, available, reserved, refundHeld });
}

export async function getCustomerWalletSummary(customerUserId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { ownerType_ownerId_currency: { ownerType: "CUSTOMER", ownerId: customerUserId, currency: "ZAR" } },
    select: {
      status: true,
      accounts: {
        where: { purpose: { in: ["CUSTOMER_WALLET_AVAILABLE", "HELD", "CUSTOMER_REFUND_HELD"] }, currency: "ZAR" },
        select: { purpose: true, category: true, status: true, allowNegative: true, ["currentBalance"]: true },
      },
    },
  });
  const available = wallet?.accounts.find((account) => account.purpose === "CUSTOMER_WALLET_AVAILABLE");
  const reserved = wallet?.accounts.find((account) => account.purpose === "HELD");
  const held = wallet?.accounts.find((account) => account.purpose === "CUSTOMER_REFUND_HELD");
  if (wallet && (
    wallet.status !== "ACTIVE"
    || (available && (available.category !== "LIABILITY" || available.status !== "ACTIVE" || available.allowNegative))
    || (reserved && (reserved.category !== "LIABILITY" || reserved.status !== "ACTIVE" || reserved.allowNegative))
    || (held && (held.category !== "LIABILITY" || held.status !== "ACTIVE" || held.allowNegative))
  )) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Customer wallet accounts are not canonical.");
  return Object.freeze({
    currency: "ZAR" as const,
    availableBalance: available?.currentBalance.toFixed(2) ?? "0.00",
    reservedBalance: reserved?.currentBalance.toFixed(2) ?? "0.00",
    refundHeldBalance: held?.currentBalance.toFixed(2) ?? "0.00",
    // Loyalty conversion can post its available-credit liability before any
    // refund has ever created the separate held-refund account. Hiding this
    // wallet until a refund arrives would conceal real redeemed funds.
    provisioned: Boolean(wallet && (available || reserved || held)),
    readable: wallet?.status === "ACTIVE" && (!available || available.status === "ACTIVE"),
    spendingEnabled: true,
  });
}

export async function listCustomerWalletTransactions(customerUserId: string, input: Readonly<{ page: number; pageSize: number }>) {
  const account = await prisma.ledgerAccount.findFirst({
    where: { purpose: "CUSTOMER_WALLET_AVAILABLE", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", allowNegative: false, wallet: { ownerType: "CUSTOMER", ownerId: customerUserId, status: "ACTIVE" } },
    select: { id: true },
  });
  if (!account) return Object.freeze({ data: Object.freeze([]), pagination: Object.freeze({ page: input.page, pageSize: input.pageSize, total: 0, totalPages: 0 }) });
  const where = { accountId: account.id };
  const [total, entries] = await prisma.$transaction([
    prisma.ledgerEntry.count({ where }),
    prisma.ledgerEntry.findMany({
      where,
      select: {
        direction: true,
        amount: true,
        lineCode: true,
        createdAt: true,
        journal: {
          select: {
            reference: true,
            type: true,
            memo: true,
            postedAt: true,
            correlationId: true,
            sourceReference: true,
            createdByUserId: true,
            metadata: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
  ]);
  return Object.freeze({
    data: Object.freeze(entries.map((entry) => {
      const meta = entry.journal.metadata && typeof entry.journal.metadata === "object" && !Array.isArray(entry.journal.metadata)
        ? (entry.journal.metadata as Record<string, unknown>)
        : {};
      const orderReference = typeof meta.orderReference === "string"
        ? meta.orderReference
        : typeof meta.checkoutReference === "string"
          ? meta.checkoutReference
          : entry.journal.correlationId ?? null;
      return Object.freeze({
        journalReference: entry.journal.reference,
        type: entry.journal.type,
        direction: entry.direction,
        amount: entry.amount.toFixed(2),
        currency: "ZAR" as const,
        description: entry.journal.memo,
        refundReference: entry.journal.correlationId,
        orderReference,
        sourceReference: entry.journal.sourceReference ?? null,
        actorType: entry.journal.createdByUserId ? "USER" as const : "SYSTEM" as const,
        postedAt: entry.journal.postedAt.toISOString(),
      });
    })),
    pagination: Object.freeze({ page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) }),
  });
}
