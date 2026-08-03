import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { RefundError } from "@/lib/refunds/errors";
import { ensureLedgerAccount, ensureWalletForOwner } from "./wallet-account.service";

function customerAccountPrefix(userId: string): string {
  return `CUSTOMER-${createHash("sha256").update(userId).digest("hex").slice(0, 24).toUpperCase()}`;
}

export async function ensureCustomerRefundWallet(customerUserId: string) {
  const customer = await prisma.user.findFirst({ where: { id: customerUserId, role: "CUSTOMER", status: "ACTIVE" }, select: { id: true } });
  if (!customer) throw new Error("Active customer is required for customer wallet provisioning.");
  const wallet = await ensureWalletForOwner({ ownerType: "CUSTOMER", ownerId: customerUserId, currency: "ZAR" });
  const prefix = customerAccountPrefix(customerUserId);
  const [available, refundHeld] = await Promise.all([
    ensureLedgerAccount({ walletId: wallet.id, code: `${prefix}-WALLET-ZAR`, purpose: "CUSTOMER_WALLET_AVAILABLE", category: "LIABILITY", currency: "ZAR" }),
    ensureLedgerAccount({ walletId: wallet.id, code: `${prefix}-REFUND-HELD-ZAR`, purpose: "CUSTOMER_REFUND_HELD", category: "LIABILITY", currency: "ZAR" }),
  ]);
  return Object.freeze({ wallet, available, refundHeld });
}

export async function getCustomerWalletSummary(customerUserId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { ownerType_ownerId_currency: { ownerType: "CUSTOMER", ownerId: customerUserId, currency: "ZAR" } },
    select: {
      status: true,
      accounts: {
        where: { purpose: { in: ["CUSTOMER_WALLET_AVAILABLE", "CUSTOMER_REFUND_HELD"] }, currency: "ZAR" },
        select: { purpose: true, category: true, status: true, allowNegative: true, ["currentBalance"]: true },
      },
    },
  });
  const available = wallet?.accounts.find((account) => account.purpose === "CUSTOMER_WALLET_AVAILABLE");
  const held = wallet?.accounts.find((account) => account.purpose === "CUSTOMER_REFUND_HELD");
  if (wallet && (
    wallet.status !== "ACTIVE"
    || (available && (available.category !== "LIABILITY" || available.status !== "ACTIVE" || available.allowNegative))
    || (held && (held.category !== "LIABILITY" || held.status !== "ACTIVE" || held.allowNegative))
  )) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Customer wallet accounts are not canonical.");
  return Object.freeze({
    currency: "ZAR" as const,
    availableBalance: available?.currentBalance.toFixed(2) ?? "0.00",
    refundHeldBalance: held?.currentBalance.toFixed(2) ?? "0.00",
    provisioned: Boolean(wallet && available && held),
    readable: wallet?.status === "ACTIVE" && available?.status === "ACTIVE",
    spendingEnabled: false,
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
      select: { direction: true, amount: true, lineCode: true, createdAt: true, journal: { select: { reference: true, type: true, memo: true, postedAt: true, correlationId: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
  ]);
  return Object.freeze({
    data: Object.freeze(entries.map((entry) => Object.freeze({
      journalReference: entry.journal.reference,
      type: entry.journal.type,
      direction: entry.direction,
      amount: entry.amount.toFixed(2),
      currency: "ZAR" as const,
      description: entry.journal.memo,
      refundReference: entry.journal.correlationId,
      postedAt: entry.journal.postedAt.toISOString(),
    }))),
    pagination: Object.freeze({ page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) }),
  });
}
