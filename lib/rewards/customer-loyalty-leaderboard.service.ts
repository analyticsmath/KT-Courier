import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Admin-only, read-only leaderboard for customers with a loyalty account.
 * Ranks are based on CURRENT available points, not the lifetime total or
 * wallet money. Customers without an account have not participated yet.
 */
export async function listCustomerLoyaltyLeaderboard(input: {
  page: number;
  pageSize: number;
}) {
  if (!Number.isSafeInteger(input.page) || input.page < 1 || input.page > 1000
    || !Number.isSafeInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 100) {
    throw new Error("Invalid leaderboard pagination.");
  }
  const skip = (input.page - 1) * input.pageSize;
  const where = { user: { role: "CUSTOMER" as const, status: "ACTIVE" as const } };
  const [total, rows] = await prisma.$transaction([
    prisma.customerLoyaltyAccount.count({ where }),
    prisma.customerLoyaltyAccount.findMany({
      where,
      select: {
        userId: true,
        availablePoints: true,
        debtPoints: true,
        lifetimeEarnedPoints: true,
        user: { select: { name: true } },
      },
      orderBy: [{ availablePoints: "desc" }, { userId: "asc" }],
      skip,
      take: input.pageSize,
    }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return {
    data: rows.map((row, index) => ({
      rank: skip + index + 1,
      customerUserId: row.userId,
      displayName: row.user.name ?? "Customer",
      availablePoints: row.availablePoints.toString(),
      pointsDebt: row.debtPoints.toString(),
      lifetimeEarnedPoints: row.lifetimeEarnedPoints.toString(),
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    },
    scope: "ACTIVE_CUSTOMERS_WITH_LOYALTY_ACCOUNTS",
  };
}
