import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import {
  CustomerLoyaltyRedemptionError,
  redeemCustomerLoyaltyPoints,
} from "@/lib/rewards/customer-loyalty-redemption.service";

describe("customer points conversion: immutable real-ZAR double-entry and concurrency", () => {
  let userId = "";
  const previousPolicy = new Map<string, Prisma.InputJsonValue>();
  beforeAll(async () => {
    requireDisposableStoreSettlementDatabase();
    const user = await prisma.user.create({
      data: { email: "loyalty-redemption-" + randomUUID() + "@example.test", role: "CUSTOMER", status: "ACTIVE" },
    });
    userId = user.id;
    await prisma.customerLoyaltyAccount.create({
      data: { userId, availablePoints: 350n, lifetimeEarnedPoints: 350n },
    });
    for (const [key, next] of [
      ["loyalty.conversion_enabled", false],
      ["loyalty.conversion_points", 100],
      ["loyalty.conversion_wallet_zar", 2],
    ] as const) {
      const setting = await prisma.systemSetting.findUniqueOrThrow({ where: { key } });
      previousPolicy.set(key, setting.value as Prisma.InputJsonValue);
      await prisma.systemSetting.update({ where: { key }, data: { value: next } });
    }
  });

  afterAll(async () => {
    for (const [key, value] of previousPolicy) {
      await prisma.systemSetting.update({ where: { key }, data: { value } });
    }
    // Journal and reward proof is immutable: discard this disposable DB after
    // testing rather than deleting financial evidence to clean the fixture.
    await prisma.$disconnect();
  });

  it("rejects new conversion until the audited admin toggle is enabled", async () => {
    await expect(redeemCustomerLoyaltyPoints({
      userId, operationId: "disabled-redemption-1", points: "100",
    })).rejects.toMatchObject({ code: "DISABLED" });
    expect(await prisma.customerLoyaltyRedemption.count({ where: { userId } })).toBe(0);
    await prisma.systemSetting.update({ where: { key: "loyalty.conversion_enabled" }, data: { value: true } });
  });

  it("atomically exchanges 100 points for R2, records exactly one balanced journal and safely replays", async () => {
    const command = { userId, operationId: "redemption-test-exact-1", points: "100" };
    const [left, right] = await Promise.all([
      redeemCustomerLoyaltyPoints(command),
      redeemCustomerLoyaltyPoints(command),
    ]);
    expect(new Set([left.status, right.status])).toEqual(new Set(["REDEEMED", "REPLAYED"]));
    expect(left.journalId).toBe(right.journalId);
    expect(left.walletCreditZar).toBe("2.00");
    expect(left.availablePoints).toBe("250");
    expect(await prisma.customerLoyaltyRedemption.count({ where: { userId } })).toBe(1);

    const receipt = await prisma.customerLoyaltyRedemption.findUniqueOrThrow({
      where: { userId_operationId: { userId, operationId: command.operationId } },
      include: { journal: { include: { entries: { include: { account: { include: { wallet: true } } } } } } },
    });
    expect(receipt.pointsRedeemed).toBe(100n);
    expect(receipt.journal.type).toBe("CUSTOMER_LOYALTY_CONVERSION");
    expect(receipt.journal.totalDebits.toFixed(2)).toBe("2.00");
    expect(receipt.journal.totalCredits.toFixed(2)).toBe("2.00");
    expect(receipt.journal.entries).toHaveLength(2);
    expect(receipt.journal.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "DEBIT", account: expect.objectContaining({
        purpose: "CUSTOMER_LOYALTY_REWARDS_EXPENSE", category: "EXPENSE",
        wallet: expect.objectContaining({ ownerType: "PLATFORM" }),
      }) }),
      expect.objectContaining({ direction: "CREDIT", account: expect.objectContaining({
        purpose: "CUSTOMER_WALLET_AVAILABLE", category: "LIABILITY",
        wallet: expect.objectContaining({ ownerType: "CUSTOMER", ownerId: userId }),
      }) }),
    ]));
    expect((await prisma.customerLoyaltyAccount.findUniqueOrThrow({ where: { userId } })).availablePoints).toBe(250n);

    await expect(redeemCustomerLoyaltyPoints({ ...command, points: "200" })).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
    expect(await prisma.customerLoyaltyRedemption.count({ where: { userId } })).toBe(1);
  });

  it("serializes competing different operations and refuses overdrafts", async () => {
    const attempts = await Promise.allSettled([
      redeemCustomerLoyaltyPoints({ userId, operationId: "parallel-redemption-a", points: "200" }),
      redeemCustomerLoyaltyPoints({ userId, operationId: "parallel-redemption-b", points: "200" }),
    ]);
    expect(attempts.filter(v => v.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(v => v.status === "rejected")).toHaveLength(1);
    const rejected = attempts.find(v => v.status === "rejected");
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(CustomerLoyaltyRedemptionError);
    expect((await prisma.customerLoyaltyAccount.findUniqueOrThrow({ where: { userId } })).availablePoints).toBe(50n);
    expect(await prisma.customerLoyaltyRedemption.count({ where: { userId } })).toBe(2);
    const account = await prisma.ledgerAccount.findFirstOrThrow({
      where: { purpose: "CUSTOMER_WALLET_AVAILABLE", wallet: { ownerId: userId, ownerType: "CUSTOMER" } },
    });
    expect(account.currentBalance.toFixed(2)).toBe("6.00");
  });

  it("refuses malformed numbers, non-block redemptions and suspended users", async () => {
    for (const points of ["0", "01", "-1", "12.5", "1e2", "NaN"]) {
      await expect(redeemCustomerLoyaltyPoints({
        userId, operationId: "invalid-points-" + randomUUID(), points,
      })).rejects.toMatchObject({ code: "INVALID_POINTS" });
    }
    await expect(redeemCustomerLoyaltyPoints({
      userId, operationId: "insufficient-small-1", points: "25",
    })).rejects.toThrow(/whole conversion blocks/i);
    await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
    await expect(redeemCustomerLoyaltyPoints({
      userId, operationId: "suspended-request-1", points: "100",
    })).rejects.toMatchObject({ code: "INELIGIBLE" });
  });
});
