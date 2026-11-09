import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { listCustomerLoyaltyLeaderboard } from "@/lib/rewards/customer-loyalty-leaderboard.service";

describe("admin customer loyalty leaderboard PostgreSQL ordering and tenant safety", () => {
  const userIds: string[] = [];
  afterAll(async () => {
    if (userIds.length) {
      await prisma.customerLoyaltyAccount.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });

  it("orders eligible customers by point balance, omits inactive accounts and noncustomers", async () => {
    requireDisposableStoreSettlementDatabase();
    const suffix = randomUUID();
    const fixtures = [
      { name: "high", role: "CUSTOMER" as const, status: "ACTIVE" as const, points: 99000000n },
      { name: "low", role: "CUSTOMER" as const, status: "ACTIVE" as const, points: 88000000n },
      { name: "inactive", role: "CUSTOMER" as const, status: "SUSPENDED" as const, points: 100000000n },
      { name: "driver", role: "DRIVER" as const, status: "ACTIVE" as const, points: 100000001n },
    ];
    const refs: Record<string, string> = {};
    for (const fixture of fixtures) {
      const user = await prisma.user.create({ data: {
        email: "loyalty-board-" + fixture.name + "-" + suffix + "@example.test",
        name: fixture.name, role: fixture.role, status: fixture.status,
      } });
      userIds.push(user.id);
      refs[fixture.name] = user.id;
      await prisma.customerLoyaltyAccount.create({ data: {
        userId: user.id, availablePoints: fixture.points, lifetimeEarnedPoints: fixture.points,
      } });
    }
    const result = await listCustomerLoyaltyLeaderboard({ page: 1, pageSize: 100 });
    expect(result.scope).toBe("ACTIVE_CUSTOMERS_WITH_LOYALTY_ACCOUNTS");
    expect(result.data[0]).toMatchObject({
      customerUserId: refs.high, availablePoints: "99000000", rank: 1,
    });
    expect(result.data[1]).toMatchObject({
      customerUserId: refs.low, availablePoints: "88000000", rank: 2,
    });
    expect(result.data.some(row => row.customerUserId === refs.inactive || row.customerUserId === refs.driver)).toBe(false);
    expect(result.pagination.total).toBeGreaterThanOrEqual(2);
    await expect(listCustomerLoyaltyLeaderboard({ page: 0, pageSize: 20 })).rejects.toThrow(/pagination/i);
  });
});
