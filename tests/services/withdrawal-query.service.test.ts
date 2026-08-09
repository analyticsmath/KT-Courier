import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    withdrawalRequest: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    payoutDestination: { findMany: vi.fn(), findUnique: vi.fn() },
    wallet: { findMany: vi.fn() },
    store: { findFirst: vi.fn() },
    driverProfile: { findFirst: vi.fn() },
    promoterProfile: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));

import {
  listOwnerWithdrawals,
  getOwnerWithdrawal,
  getFinanceWithdrawal,
} from "@/lib/services/withdrawal-query.service";

describe("withdrawal query service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("covers owner masking and finance-safe evidence DTOs", async () => {
    const mockRow = {
      id: "wd-1",
      publicReference: "WD-100",
      requestedByUserId: "user-1",
      amount: new Prisma.Decimal(150),
      status: "REQUESTED",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      payoutDestination: {
        publicReference: "PD-1",
        maskedLabel: "Standard Bank ****1234",
        institutionName: "Standard Bank",
        accountLast4: "1234",
      },
      payoutAttempts: [{ publicReference: "WPA-1", status: "PROCESSING" }],
      statusHistory: [{ fromStatus: null, toStatus: "REQUESTED", reasonCode: "CREATED", createdAt: new Date("2026-01-01T00:00:00Z") }],
    };

    mocks.prisma.withdrawalRequest.count.mockResolvedValue(1);
    mocks.prisma.withdrawalRequest.findMany.mockResolvedValue([mockRow]);
    mocks.prisma.$transaction.mockImplementation((args: unknown) => Array.isArray(args) ? Promise.all(args) : args);

    const ownerList = await listOwnerWithdrawals("user-1", { page: 1, pageSize: 10 });
    expect(ownerList.data).toHaveLength(1);
    expect(ownerList.data[0].destination.maskedLabel).toBe("Standard Bank ****1234");
    expect(ownerList.data[0].amount).toBe("150.00");
    expect(ownerList.data[0]).not.toHaveProperty("rawBankAccount");
  });

  it("fetches single owner withdrawal detail scoped strictly by user", async () => {
    const mockRow = {
      id: "wd-1",
      publicReference: "WD-100",
      requestedByUserId: "user-1",
      amount: new Prisma.Decimal(150),
      status: "REQUESTED",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      payoutDestination: {
        publicReference: "PD-1",
        maskedLabel: "Standard Bank ****1234",
        institutionName: "Standard Bank",
        accountLast4: "1234",
      },
      payoutAttempts: [],
      statusHistory: [],
    };

    mocks.prisma.withdrawalRequest.findFirst.mockResolvedValue(mockRow);

    const detail = await getOwnerWithdrawal("user-1", "WD-100");
    expect(detail?.publicReference).toBe("WD-100");
    expect(mocks.prisma.withdrawalRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publicReference: "WD-100", requestedByUserId: "user-1" } })
    );
  });

  it("provides finance-level DTOs for admin queries", async () => {
    const mockFinanceRow = {
      id: "wd-1",
      publicReference: "WD-100",
      ownerType: "STORE",
      amount: new Prisma.Decimal(150),
      status: "APPROVED",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      approvedAt: new Date("2026-01-02T00:00:00Z"),
      approvedByUserId: "admin-1",
      completedAt: null,
      completedByUserId: null,
      payoutDestination: { publicReference: "PD-1", maskedLabel: "Standard Bank ****1234", status: "ACTIVE" },
      reserveLedgerJournal: { reference: "J-RES-1" },
      releaseLedgerJournal: null,
      payoutLedgerJournal: null,
      payoutAttempts: [],
      statusHistory: [],
      reconciliationCases: [],
    };

    mocks.prisma.withdrawalRequest.findUnique.mockResolvedValue(mockFinanceRow);

    const financeDetail = await getFinanceWithdrawal("wd-1");
    expect(financeDetail?.journals.reserve).toBe("J-RES-1");
    expect(financeDetail?.approval.approvedByUserId).toBe("admin-1");
  });
});
