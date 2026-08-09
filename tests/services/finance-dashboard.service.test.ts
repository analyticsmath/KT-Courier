import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    withdrawalRequest: { groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    ledgerAccount: { aggregate: vi.fn(), findUnique: vi.fn() },
    withdrawalReconciliationCase: { count: vi.fn() },
    wallet: { findUnique: vi.fn() },
    commissionAllocation: { aggregate: vi.fn() },
    commissionAccrual: { aggregate: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    commissionReconciliationCase: { count: vi.fn() },
    commissionPlan: { findMany: vi.fn() },
    paymentRefund: { groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    refundReconciliationCase: { count: vi.fn() },
    refundFundingAllocation: { aggregate: vi.fn() },
    payment: { findMany: vi.fn() },
  },
  summarizeStoreEarnings: vi.fn(),
  summarizeDriverEarnings: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/services/store-earning-summary.service", () => ({ summarizeStoreEarnings: mocks.summarizeStoreEarnings }));
vi.mock("@/lib/services/driver-earning-summary.service", () => ({ summarizeDriverEarnings: mocks.summarizeDriverEarnings }));

import { getFinanceDashboard } from "@/lib/services/finance-dashboard.service";

describe("finance dashboard service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.summarizeStoreEarnings.mockResolvedValue({ totalWithdrawable: "1000.00" });
    mocks.summarizeDriverEarnings.mockResolvedValue({ totalWithdrawable: "500.00" });

    mocks.prisma.withdrawalRequest.groupBy.mockResolvedValue([
      { status: "REQUESTED", _sum: { amount: new Prisma.Decimal(250) }, _count: { _all: 2 } },
      { status: "PAID", _sum: { amount: new Prisma.Decimal(1000) }, _count: { _all: 5 } },
    ]);
    mocks.prisma.ledgerAccount.aggregate.mockImplementation(async ({ where }) => {
      if (where?.purpose === "WITHDRAWAL_HELD") return { _sum: { currentBalance: new Prisma.Decimal(250) } };
      if (where?.purpose === "CUSTOMER_WALLET_AVAILABLE") return { _sum: { currentBalance: new Prisma.Decimal(100) } };
      if (where?.purpose === "CUSTOMER_REFUND_HELD") return { _sum: { currentBalance: new Prisma.Decimal(50) } };
      return { _sum: { currentBalance: new Prisma.Decimal(0) } };
    });
    mocks.prisma.withdrawalRequest.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(1000) } });
    mocks.prisma.withdrawalReconciliationCase.count.mockResolvedValue(0);
    mocks.prisma.wallet.findUnique.mockResolvedValue({ id: "platform_wallet" });
    mocks.prisma.ledgerAccount.findUnique.mockResolvedValue({ currentBalance: new Prisma.Decimal(5000) });

    mocks.prisma.commissionAllocation.aggregate.mockImplementation(async ({ where }) => {
      if (where?.allocationType === "PLATFORM_COMMISSION_REVENUE") return { _sum: { amount: new Prisma.Decimal(150) } };
      return { _sum: { amount: new Prisma.Decimal(50) } };
    });
    mocks.prisma.commissionAccrual.aggregate.mockImplementation(async ({ where }) => {
      if (where?.status === "REVERSED") return { _sum: { totalAmount: new Prisma.Decimal(0) } };
      return { _sum: { totalAmount: new Prisma.Decimal(200) } };
    });
    mocks.prisma.commissionReconciliationCase.count.mockResolvedValue(0);
    mocks.prisma.commissionAccrual.groupBy.mockResolvedValue([]);
    mocks.prisma.withdrawalRequest.findMany.mockResolvedValue([]);
    mocks.prisma.commissionPlan.findMany.mockResolvedValue([]);
    mocks.prisma.commissionAccrual.findMany.mockResolvedValue([]);

    mocks.prisma.paymentRefund.groupBy.mockResolvedValue([]);
    mocks.prisma.paymentRefund.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) }, _count: { _all: 0 } });
    mocks.prisma.refundReconciliationCase.count.mockResolvedValue(0);
    mocks.prisma.refundFundingAllocation.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } });
    mocks.prisma.paymentRefund.findMany.mockResolvedValue([]);
    mocks.prisma.payment.findMany.mockResolvedValue([]);
  });

  it("covers exact Decimal dashboard aggregation and balance formatting", async () => {
    const dashboard = await getFinanceDashboard();

    expect(dashboard.currency).toBe("ZAR");
    expect(dashboard.totalHeld).toBe("250.00");
    expect(dashboard.totalPaid).toBe("1000.00");
    expect(dashboard.cashClearingBalance).toBe("5000.00");
    expect(dashboard.commissions.accruedPlatformRevenue).toBe("150.00");
    expect(dashboard.commissions.beneficiaryPayable).toBe("50.00");
    expect(dashboard.refunds.walletLiabilities).toBe("100.00");
    expect(dashboard.refunds.refundHeldLiabilities).toBe("50.00");
  });
});
