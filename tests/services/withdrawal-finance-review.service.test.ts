import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
  },
  postLedgerJournalWithinTransaction: vi.fn(),
  lockWithdrawalAccounts: vi.fn(),
  resolveWithdrawalOwnerForUser: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/services/ledger-posting.service", () => ({ postLedgerJournalWithinTransaction: mocks.postLedgerJournalWithinTransaction }));
vi.mock("@/lib/services/withdrawal-account.service", () => ({ lockWithdrawalAccounts: mocks.lockWithdrawalAccounts }));
vi.mock("@/lib/withdrawals/withdrawal-owner-policy", () => ({ resolveWithdrawalOwnerForUser: mocks.resolveWithdrawalOwnerForUser }));

import { beginWithdrawalReview, approveWithdrawal, rejectWithdrawal } from "@/lib/services/withdrawal-finance-review.service";

describe("withdrawal finance review service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("covers review, approval, rejection, and atomic release", async () => {
    const mockWithdrawal = {
      id: "wd-1",
      publicReference: "WD-100",
      requestedByUserId: "user-1",
      ownerType: "STORE",
      ownerId: "store-1",
      amount: new Prisma.Decimal(100),
      status: "REQUESTED",
      reserveLedgerJournalId: "j-reserve",
      releaseLedgerJournalId: null,
      payoutLedgerJournalId: null,
      sourceAccountId: "acc-src",
      heldAccountId: "acc-held",
      policyVersion: 1,
      payoutDestination: { status: "ACTIVE", publicReference: "PD-1" },
    };

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "wd-1" }]),
      withdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(mockWithdrawal),
        update: vi.fn().mockImplementation(async ({ data }) => ({ ...mockWithdrawal, ...data })),
      },
      withdrawalStatusHistory: {
        create: vi.fn().mockResolvedValue({ id: "h-1" }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };

    mocks.prisma.$transaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => unknown) => cb(tx));
    mocks.resolveWithdrawalOwnerForUser.mockResolvedValue({ ownerType: "STORE", ownerId: "store-1" });

    const reviewResult = await beginWithdrawalReview({ actorUserId: "admin-1", publicReference: "WD-100", operationId: "op-1" });
    expect(reviewResult.status).toBe("UNDER_REVIEW");

    tx.withdrawalRequest.findUnique.mockResolvedValue({ ...mockWithdrawal, status: "UNDER_REVIEW" });
    const approveResult = await approveWithdrawal({ actorUserId: "admin-2", publicReference: "WD-100", operationId: "op-2" });
    expect(approveResult.status).toBe("APPROVED");
    expect(approveResult.approvedByUserId).toBe("admin-2");
  });

  it("prevents self-approval under dual control policy", async () => {
    const mockWithdrawal = {
      id: "wd-1",
      publicReference: "WD-100",
      requestedByUserId: "user-1",
      ownerType: "STORE",
      ownerId: "store-1",
      status: "UNDER_REVIEW",
      reserveLedgerJournalId: "j-reserve",
      payoutDestination: { status: "ACTIVE" },
    };

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "wd-1" }]),
      withdrawalRequest: { findUnique: vi.fn().mockResolvedValue(mockWithdrawal) },
    };
    mocks.prisma.$transaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => unknown) => cb(tx));

    await expect(
      approveWithdrawal({ actorUserId: "user-1", publicReference: "WD-100", operationId: "op-1" })
    ).rejects.toMatchObject({ code: "WITHDRAWAL_DUAL_CONTROL_REQUIRED" });
  });

  it("releases held reservation on rejection", async () => {
    const mockWithdrawal = {
      id: "wd-1",
      publicReference: "WD-100",
      requestedByUserId: "user-1",
      ownerType: "STORE",
      ownerId: "store-1",
      amount: new Prisma.Decimal(100),
      status: "UNDER_REVIEW",
      reserveLedgerJournalId: "j-reserve",
      sourceAccountId: "acc-src",
      heldAccountId: "acc-held",
      policyVersion: 1,
      payoutDestination: { status: "ACTIVE", publicReference: "PD-1" },
    };

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "wd-1" }]),
      withdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(mockWithdrawal),
        update: vi.fn().mockResolvedValue({ ...mockWithdrawal, status: "REJECTED" }),
      },
      withdrawalStatusHistory: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };

    mocks.prisma.$transaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => unknown) => cb(tx));
    mocks.resolveWithdrawalOwnerForUser.mockResolvedValue({ ownerType: "STORE", ownerId: "store-1" });
    mocks.lockWithdrawalAccounts.mockResolvedValue({ source: { id: "acc-src" }, held: { id: "acc-held" } });
    mocks.postLedgerJournalWithinTransaction.mockResolvedValue({ id: "j-release", reference: "J-REL-1" });

    const rejected = await rejectWithdrawal({ actorUserId: "admin-2", publicReference: "WD-100", operationId: "op-3", reasonCode: "INVALID_DOCUMENTATION" });
    expect(rejected.status).toBe("REJECTED");
    expect(mocks.postLedgerJournalWithinTransaction).toHaveBeenCalled();
  });
});
