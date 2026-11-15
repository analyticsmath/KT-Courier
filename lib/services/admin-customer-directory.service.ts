import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { UserRole, UserStatus } from "@/types/db";

const MAX_CUSTOMER_SUMMARY_BATCH = 100;

export interface AdminCustomerDirectoryStats {
  readonly totalAccounts: number;
  readonly totalCustomers: number;
  readonly activeCustomers: number;
  readonly verifiedCustomers: number;
}

export interface AdminCustomerAccountSummary {
  readonly userId: string;
  readonly parcelOrderCount: number;
  readonly parcelPaidSpendZar: string;
  readonly marketplaceOrderCount: number;
  readonly marketplacePaidSpendZar: string;
  readonly totalOrderCount: number;
  readonly totalPaidSpendZar: string;
  readonly walletAvailableZar: string;
  readonly loyaltyAvailablePoints: number;
  readonly loyaltyDebtPoints: number;
  readonly referralCode: string | null;
  readonly referralsPending: number;
  readonly referralsRewarded: number;
  readonly referralsCancelledOrExpired: number;
}

export async function getAdminCustomerDirectoryStats(): Promise<AdminCustomerDirectoryStats> {
  const [totalAccounts, totalCustomers, activeCustomers, verifiedCustomers] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      prisma.user.count({
        where: { role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
      }),
      prisma.user.count({
        where: {
          role: UserRole.CUSTOMER,
          emailVerifiedAt: { not: null },
        },
      }),
    ]);

  return {
    totalAccounts,
    totalCustomers,
    activeCustomers,
    verifiedCustomers,
  };
}

/**
 * Loads bounded per-customer operational summaries strictly scoped to the
 * provided page user IDs (never an unbounded full-table scan).
 */
export async function getAdminCustomerSummariesForUserIds(
  userIds: readonly string[],
): Promise<Map<string, AdminCustomerAccountSummary>> {
  const boundedIds = [...new Set(userIds.filter(Boolean))].slice(
    0,
    MAX_CUSTOMER_SUMMARY_BATCH,
  );
  const result = new Map<string, AdminCustomerAccountSummary>();
  if (boundedIds.length === 0) return result;

  const [
    parcelCounts,
    marketplaceCounts,
    paidPaymentsBySubject,
    walletAccounts,
    loyaltyAccounts,
    referralCodes,
  ] = await Promise.all([
    prisma.order.groupBy({
      by: ["customerId"],
      where: { customerId: { in: boundedIds } },
      _count: { _all: true },
    }),
    prisma.marketplaceOrder.groupBy({
      by: ["customerUserId"],
      where: { customerUserId: { in: boundedIds } },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ["userId", "subjectType"],
      where: {
        userId: { in: boundedIds },
        status: "SUCCEEDED",
        currency: "ZAR",
        subjectType: { in: ["COURIER_ORDER", "MARKETPLACE_CHECKOUT"] },
      },
      _sum: { amount: true },
    }),
    prisma.ledgerAccount.findMany({
      where: {
        purpose: "CUSTOMER_WALLET_AVAILABLE",
        category: "LIABILITY",
        currency: "ZAR",
        status: "ACTIVE",
        wallet: {
          ownerType: "CUSTOMER",
          ownerId: { in: boundedIds },
          status: "ACTIVE",
        },
      },
      select: {
        currentBalance: true,
        wallet: { select: { ownerId: true } },
      },
    }),
    prisma.customerLoyaltyAccount.findMany({
      where: { userId: { in: boundedIds } },
      select: {
        userId: true,
        availablePoints: true,
        debtPoints: true,
      },
    }),
    prisma.referralCode.findMany({
      where: {
        ownerType: "CUSTOMER",
        ownerId: { in: boundedIds },
      },
      select: {
        id: true,
        ownerId: true,
        code: true,
        events: {
          select: { status: true },
        },
      },
    }),
  ]);

  const parcelCountByUser = new Map<string, number>();
  for (const row of parcelCounts) {
    if (row.customerId) parcelCountByUser.set(row.customerId, row._count._all);
  }

  const marketplaceCountByUser = new Map<string, number>();
  for (const row of marketplaceCounts) {
    if (row.customerUserId) {
      marketplaceCountByUser.set(row.customerUserId, row._count._all);
    }
  }

  const parcelSpendByUser = new Map<string, Prisma.Decimal>();
  const marketplaceSpendByUser = new Map<string, Prisma.Decimal>();
  for (const row of paidPaymentsBySubject) {
    if (!row.userId || !row._sum.amount) continue;
    const amount = new Prisma.Decimal(row._sum.amount);
    if (row.subjectType === "COURIER_ORDER") {
      parcelSpendByUser.set(row.userId, amount);
    } else if (row.subjectType === "MARKETPLACE_CHECKOUT") {
      marketplaceSpendByUser.set(row.userId, amount);
    }
  }

  const walletByUser = new Map<string, Prisma.Decimal>();
  for (const row of walletAccounts) {
    walletByUser.set(row.wallet.ownerId, new Prisma.Decimal(row.currentBalance));
  }

  const loyaltyByUser = new Map<
    string,
    { availablePoints: number; debtPoints: number }
  >();
  for (const row of loyaltyAccounts) {
    loyaltyByUser.set(row.userId, {
      availablePoints: Number(row.availablePoints),
      debtPoints: Number(row.debtPoints),
    });
  }

  const referralByUser = new Map<
    string,
    {
      code: string | null;
      pending: number;
      rewarded: number;
      cancelledOrExpired: number;
    }
  >();
  for (const codeRow of referralCodes) {
    const current = referralByUser.get(codeRow.ownerId) ?? {
      code: codeRow.code,
      pending: 0,
      rewarded: 0,
      cancelledOrExpired: 0,
    };
    if (!current.code) current.code = codeRow.code;
    for (const ev of codeRow.events) {
      if (ev.status === "REWARDED") current.rewarded += 1;
      else if (ev.status === "CANCELLED" || ev.status === "EXPIRED") {
        current.cancelledOrExpired += 1;
      } else {
        current.pending += 1;
      }
    }
    referralByUser.set(codeRow.ownerId, current);
  }

  for (const userId of boundedIds) {
    const parcelCount = parcelCountByUser.get(userId) ?? 0;
    const marketplaceCount = marketplaceCountByUser.get(userId) ?? 0;
    const parcelSpend = parcelSpendByUser.get(userId) ?? new Prisma.Decimal(0);
    const marketplaceSpend =
      marketplaceSpendByUser.get(userId) ?? new Prisma.Decimal(0);
    const totalSpend = parcelSpend.add(marketplaceSpend);
    const walletBalance = walletByUser.get(userId) ?? new Prisma.Decimal(0);
    const loyalty = loyaltyByUser.get(userId) ?? {
      availablePoints: 0,
      debtPoints: 0,
    };
    const referrals = referralByUser.get(userId) ?? {
      code: null,
      pending: 0,
      rewarded: 0,
      cancelledOrExpired: 0,
    };

    result.set(userId, {
      userId,
      parcelOrderCount: parcelCount,
      parcelPaidSpendZar: parcelSpend.toFixed(2),
      marketplaceOrderCount: marketplaceCount,
      marketplacePaidSpendZar: marketplaceSpend.toFixed(2),
      totalOrderCount: parcelCount + marketplaceCount,
      totalPaidSpendZar: totalSpend.toFixed(2),
      walletAvailableZar: walletBalance.toFixed(2),
      loyaltyAvailablePoints: loyalty.availablePoints,
      loyaltyDebtPoints: loyalty.debtPoints,
      referralCode: referrals.code,
      referralsPending: referrals.pending,
      referralsRewarded: referrals.rewarded,
      referralsCancelledOrExpired: referrals.cancelledOrExpired,
    });
  }

  return result;
}
