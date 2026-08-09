import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
  },
  postLedgerJournalWithinTransaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/services/ledger-posting.service", () => ({ postLedgerJournalWithinTransaction: mocks.postLedgerJournalWithinTransaction }));

import {
  startWithdrawalPayout,
  recordWithdrawalPayoutFailure,
  recordWithdrawalPayoutUnknown,
  completeManualWithdrawalPayout,
} from "@/lib/services/withdrawal-payout.service";

describe("withdrawal payout service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts payout processing for an approved withdrawal", async () => {
    const mockWithdrawal = {
      id: "wd-1",
      publicReference: "WD-100",
      status: "APPROVED",
      approvedByUserId: "admin-1",
      requestedByUserId: "user-1",
      latestAttemptNumber: 0,
      payoutDestination: { status: "ACTIVE" },
    };

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "wd-1" }]),
      withdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(mockWithdrawal),
        update: vi.fn().mockResolvedValue({ ...mockWithdrawal, status: "PROCESSING" }),
      },
      withdrawalPayoutAttempt: {
        count: vi.fn().mockResolvedValue(0),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "att-1", publicReference: "WPA-1", attemptNumber: 1 }),
        update: vi.fn().mockResolvedValue({ id: "att-1", publicReference: "WPA-1", status: "PROCESSING" }),
      },
      withdrawalStatusHistory: { create: vi.fn().mockResolvedValue({ id: "h-1" }) },
    };

    mocks.prisma.$transaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => unknown) => cb(tx));

    const attempt = await startWithdrawalPayout({
      actorUserId: "admin-2",
      publicReference: "WD-100",
      operationId: "op-start-12345",
    });

    expect(attempt.status).toBe("PROCESSING");
  });

  it("records payout failure and resets withdrawal status to APPROVED", async () => {
    const mockWithdrawal = {
      id: "wd-1",
      publicReference: "WD-100",
      status: "PROCESSING",
      currentPayoutAttemptId: "att-1",
    };
    const mockAttempt = {
      id: "att-1",
      publicReference: "WPA-1",
      withdrawalId: "wd-1",
      status: "PROCESSING",
    };

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "wd-1" }]),
      withdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(mockWithdrawal),
        update: vi.fn().mockResolvedValue({ ...mockWithdrawal, status: "APPROVED", currentPayoutAttemptId: null }),
      },
      withdrawalPayoutAttempt: {
        findUnique: vi.fn().mockResolvedValue(mockAttempt),
        update: vi.fn().mockResolvedValue({ ...mockAttempt, status: "FAILED" }),
      },
      withdrawalStatusHistory: { create: vi.fn().mockResolvedValue({ id: "h-1" }) },
    };

    mocks.prisma.$transaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => unknown) => cb(tx));

    const updated = await recordWithdrawalPayoutFailure({
      actorUserId: "admin-2",
      withdrawalPublicReference: "WD-100",
      payoutAttemptPublicReference: "WPA-1",
      operationId: "op-fail-12345",
      failureCategory: "EXTERNAL_SYSTEM_REJECTED",
      failureCode: "BANK_NETWORK_REJECT",
    });

    expect(updated.status).toBe("APPROVED");
  });

  it("records unknown outcome and triggers reconciliation case", async () => {
    const mockWithdrawal = {
      id: "wd-1",
      publicReference: "WD-100",
      status: "PROCESSING",
      currentPayoutAttemptId: "att-1",
    };
    const mockAttempt = {
      id: "att-1",
      publicReference: "WPA-1",
      withdrawalId: "wd-1",
      status: "PROCESSING",
    };

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "wd-1" }]),
      withdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(mockWithdrawal),
        update: vi.fn().mockResolvedValue({ ...mockWithdrawal, status: "RECONCILIATION_REQUIRED" }),
      },
      withdrawalPayoutAttempt: {
        findUnique: vi.fn().mockResolvedValue(mockAttempt),
        update: vi.fn().mockResolvedValue({ ...mockAttempt, status: "UNKNOWN" }),
      },
      withdrawalReconciliationCase: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "case-1" }),
      },
      withdrawalStatusHistory: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };

    mocks.prisma.$transaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => unknown) => cb(tx));

    const updated = await recordWithdrawalPayoutUnknown({
      actorUserId: "admin-2",
      withdrawalPublicReference: "WD-100",
      payoutAttemptPublicReference: "WPA-1",
      operationId: "op-unk-12345",
    });

    expect(updated.status).toBe("RECONCILIATION_REQUIRED");
    expect(tx.withdrawalReconciliationCase.create).toHaveBeenCalled();
  });

  it("completes manual payout and posts payout journal when cash liquidity is verified", async () => {
    const mockWithdrawal = {
      id: "wd-1",
      publicReference: "WD-100",
      status: "PROCESSING",
      requestedByUserId: "user-1",
      approvedByUserId: "admin-1",
      amount: new Prisma.Decimal(100),
      reserveLedgerJournalId: "j-reserve",
      releaseLedgerJournalId: null,
      payoutLedgerJournalId: null,
      sourceAccountId: "acc-src",
      heldAccountId: "acc-held",
      policyVersion: 1,
      ownerType: "STORE",
      payoutDestination: { status: "ACTIVE", publicReference: "PD-1" },
    };
    const mockAttempt = {
      id: "att-1",
      publicReference: "WPA-1",
      withdrawalId: "wd-1",
      status: "PROCESSING",
    };

    const tx = {
      $queryRaw: vi.fn().mockImplementation(async (query: { strings: readonly string[] }) => {
        const text = String(query.strings);
        if (text.includes("WithdrawalRequest")) return [{ id: "wd-1" }];
        if (text.includes("WithdrawalPayoutAttempt")) return [{ id: "att-1" }];
        return [{ id: "acc-held" }, { id: "acc-cash" }];
      }),
      withdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(mockWithdrawal),
        update: vi.fn().mockResolvedValue({ ...mockWithdrawal, status: "PAID" }),
      },
      withdrawalPayoutAttempt: {
        findUnique: vi.fn().mockImplementation(async ({ where }) => {
          if (where.id === "att-1") return mockAttempt;
          return null;
        }),
        update: vi.fn().mockResolvedValue({ ...mockAttempt, status: "SUCCEEDED" }),
      },
      wallet: {
        findUnique: vi.fn().mockResolvedValue({ id: "pw-1", status: "ACTIVE" }),
      },
      ledgerAccount: {
        findUnique: vi.fn().mockResolvedValue({ id: "acc-cash", category: "ASSET", status: "ACTIVE", allowNegative: false }),
        findMany: vi.fn().mockResolvedValue([
          { id: "acc-held", purpose: "WITHDRAWAL_HELD", category: "LIABILITY", currentBalance: new Prisma.Decimal(100) },
          { id: "acc-cash", purpose: "CASH_CLEARING", category: "ASSET", currentBalance: new Prisma.Decimal(1000) },
        ]),
      },
      withdrawalReconciliationCase: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      withdrawalStatusHistory: { create: vi.fn().mockResolvedValue({ id: "h-1" }) },
    };

    mocks.prisma.$transaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => unknown) => cb(tx));
    mocks.postLedgerJournalWithinTransaction.mockResolvedValue({ id: "j-payout", reference: "J-PO-1" });

    const completed = await completeManualWithdrawalPayout({
      actorUserId: "admin-2",
      withdrawalPublicReference: "WD-100",
      payoutAttemptPublicReference: "WPA-1",
      externalPayoutReference: "manual-bank:mb-ref-12345",
      operationId: "op-comp-12345",
    });

    expect(completed.status).toBe("PAID");
    expect(mocks.postLedgerJournalWithinTransaction).toHaveBeenCalled();
  });
});
