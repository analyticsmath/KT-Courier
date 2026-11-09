import { createHash } from "node:crypto";
import { Prisma, SystemSettingType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { loadCustomerRewardPolicy } from "@/lib/rewards/customer-reward-configuration";
import { loyaltyWalletConversion } from "@/lib/rewards/customer-reward-policy";
import { ensureWalletForOwnerInTx, ensureLedgerAccountInTx } from "@/lib/services/wallet-account.service";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";

export class CustomerLoyaltyRedemptionError extends Error {
  constructor(
    readonly code: "DISABLED" | "INVALID_POINTS" | "INELIGIBLE" | "INSUFFICIENT_POINTS" | "IDEMPOTENCY_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "CustomerLoyaltyRedemptionError";
  }
}

const MAX_POINTS = 9223372036854775807n;

export function parseRedemptionPoints(input: unknown): bigint {
  if (typeof input !== "string" || !/^[1-9]\d{0,18}$/.test(input)) {
    throw new CustomerLoyaltyRedemptionError("INVALID_POINTS", "Points must be a positive whole-number string.");
  }
  const points = BigInt(input);
  if (points > MAX_POINTS) throw new CustomerLoyaltyRedemptionError("INVALID_POINTS", "Points exceed the supported balance.");
  return points;
}

/** Convert points and post customer-wallet credit in ONE serializable journal.
 * The same User lock is used by loyalty earning and refund reconciliation.
 * The launch setting defaults OFF until independent owner/finance approval.
 */
export async function redeemCustomerLoyaltyPoints(input: Readonly<{
  userId: string;
  operationId: string;
  points: string;
}>) {
  const requested = parseRedemptionPoints(input.points);
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{7,95}$/.test(input.operationId)) {
    throw new CustomerLoyaltyRedemptionError("INVALID_POINTS", "A valid idempotency operation ID is required.");
  }
  if (!input.userId.trim()) throw new CustomerLoyaltyRedemptionError("INELIGIBLE", "An active customer is required.");

  return withLedgerRetry(() => prisma.$transaction(async tx => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${input.userId} FOR UPDATE`,
    );
    if (locked.length !== 1) throw new CustomerLoyaltyRedemptionError("INELIGIBLE", "Customer not found.");
    const customer = await tx.user.findUniqueOrThrow({ where: { id: input.userId }, select: { role: true, status: true } });
    if (customer.role !== "CUSTOMER" || customer.status !== "ACTIVE") {
      throw new CustomerLoyaltyRedemptionError("INELIGIBLE", "An active customer is required.");
    }

    const replay = await tx.customerLoyaltyRedemption.findUnique({
      where: { userId_operationId: { userId: input.userId, operationId: input.operationId } },
    });
    if (replay) {
      if (replay.pointsRedeemed !== requested) {
        throw new CustomerLoyaltyRedemptionError("IDEMPOTENCY_CONFLICT", "Operation ID was already used for different points.");
      }
      return {
        status: "REPLAYED" as const, redemptionId: replay.id,
        pointsRedeemed: replay.pointsRedeemed.toString(),
        availablePoints: replay.availablePointsAfter.toString(),
        walletCreditZar: replay.walletCreditAmount.toFixed(2),
        journalId: replay.journalId,
      };
    }

    const setting = await tx.systemSetting.findUnique({
      where: { key: "loyalty.conversion_enabled" }, select: { type: true, value: true },
    });
    if (setting?.type !== SystemSettingType.BOOLEAN || setting.value !== true) {
      throw new CustomerLoyaltyRedemptionError("DISABLED", "Loyalty wallet conversion is not enabled.");
    }
    const account = await tx.customerLoyaltyAccount.findUnique({ where: { userId: input.userId } });
    if (!account || account.debtPoints !== 0n || account.availablePoints < requested) {
      throw new CustomerLoyaltyRedemptionError("INSUFFICIENT_POINTS", "Insufficient eligible points.");
    }
    const policy = await loadCustomerRewardPolicy(tx);
    const conversion = loyaltyWalletConversion({
      availablePoints: account.availablePoints,
      requestedPoints: requested,
      conversionPoints: policy.conversionPoints,
      conversionWalletZar: policy.conversionWalletZar,
    });
    const customerWallet = await ensureWalletForOwnerInTx(tx, { ownerType: "CUSTOMER", ownerId: input.userId, currency: "ZAR" });
    const ownerHash = createHash("sha256").update(input.userId).digest("hex").slice(0, 24).toUpperCase();
    const available = await ensureLedgerAccountInTx(tx, {
      walletId: customerWallet.id, code: `CUSTOMER-${ownerHash}-WALLET-ZAR`,
      purpose: "CUSTOMER_WALLET_AVAILABLE", category: "LIABILITY", currency: "ZAR",
    });
    const platformWallet = await ensureWalletForOwnerInTx(tx, { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
    const expense = await ensureLedgerAccountInTx(tx, {
      walletId: platformWallet.id, code: "PLATFORM-LOYALTY-REWARDS-EXPENSE-ZAR",
      purpose: "CUSTOMER_LOYALTY_REWARDS_EXPENSE", category: "EXPENSE", currency: "ZAR",
    });
    const key = createHash("sha256").update(`${input.userId}:${input.operationId}`).digest("hex").toUpperCase();
    const journal = await postLedgerJournalWithinTransaction(tx, {
      idempotencyKey: `loyalty-conversion-${key}`,
      sourceReference: `LOYALTY_CONVERSION:${key}`,
      correlationId: input.operationId,
      type: "CUSTOMER_LOYALTY_CONVERSION",
      currency: "ZAR",
      actor: { kind: "USER", userId: input.userId },
      memo: "Loyalty points converted to nonwithdrawable customer wallet credit.",
      metadata: { points: requested.toString(), ratePoints: String(policy.conversionPoints), rateZar: policy.conversionWalletZar },
      entries: [
        { accountId: expense.id, direction: "DEBIT", amount: conversion.walletCreditZar, lineCode: "LOYALTY-EXPENSE" },
        { accountId: available.id, direction: "CREDIT", amount: conversion.walletCreditZar, lineCode: "CUSTOMER-WALLET-CREDIT" },
      ],
    });

    const changed = await tx.customerLoyaltyAccount.updateMany({
      where: { userId: input.userId, version: account.version, availablePoints: { gte: requested }, debtPoints: 0n },
      data: { availablePoints: { decrement: requested }, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new CustomerLoyaltyRedemptionError("INSUFFICIENT_POINTS", "Loyalty balance changed.");

    const receipt = await tx.customerLoyaltyRedemption.create({
      data: {
        userId: input.userId, operationId: input.operationId,
        pointsRedeemed: requested, availablePointsAfter: conversion.remainingPoints,
        walletCreditAmount: new Prisma.Decimal(conversion.walletCreditZar),
        pointsRequired: policy.conversionPoints,
        walletRateAmount: new Prisma.Decimal(policy.conversionWalletZar),
        journalId: journal.id,
      },
    });
    return {
      status: "REDEEMED" as const, redemptionId: receipt.id,
      pointsRedeemed: requested.toString(),
      availablePoints: conversion.remainingPoints.toString(),
      walletCreditZar: conversion.walletCreditZar,
      journalId: journal.id,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 }));
}
