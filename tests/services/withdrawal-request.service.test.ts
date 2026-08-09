import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    withdrawalRequest: { findUnique: vi.fn() },
  },
  postLedgerJournalWithinTransaction: vi.fn(),
  lockWithdrawalAccounts: vi.fn(),
  resolveWithdrawalOwnerForUser: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/services/ledger-posting.service", () => ({ postLedgerJournalWithinTransaction: mocks.postLedgerJournalWithinTransaction }));
vi.mock("@/lib/services/withdrawal-account.service", () => ({ lockWithdrawalAccounts: mocks.lockWithdrawalAccounts }));
vi.mock("@/lib/withdrawals/withdrawal-owner-policy", () => ({ resolveWithdrawalOwnerForUser: mocks.resolveWithdrawalOwnerForUser }));

import { createWithdrawalRequest, cancelWithdrawalRequest } from "@/lib/services/withdrawal-request.service";

describe("withdrawal request service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reserves ledger funds and creates a withdrawal request for eligible owner", async () => {
    const mockOwner = { ownerType: "STORE", ownerId: "store-1", userId: "user-1" };
    const mockWallet = { id: "wallet-1", status: "ACTIVE" };
    const mockPolicy = { enabled: true, ownerType: "STORE", currency: "ZAR", minimumAmount: null, maximumAmount: null, version: 1 };
    const mockDestination = { id: "dest-1", publicReference: "PD-1", walletId: "wallet-1", ownerType: "STORE", ownerId: "store-1", currency: "ZAR", status: "ACTIVE" };

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "wallet-1" }]),
      wallet: { findUnique: vi.fn().mockResolvedValue(mockWallet) },
      withdrawalPolicy: { findUnique: vi.fn().mockResolvedValue(mockPolicy) },
      payoutDestination: { findUnique: vi.fn().mockResolvedValue(mockDestination) },
      withdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } }),
        create: vi.fn().mockResolvedValue({ id: "wd-1", publicReference: "WD-100", status: "REQUESTED", amount: new Prisma.Decimal(100) }),
      },
      ledgerAccount: {
        findMany: vi.fn().mockResolvedValue([
          { id: "acc-src", purpose: "OWNER_WITHDRAWABLE" },
          { id: "acc-held", purpose: "WITHDRAWAL_HELD" },
        ]),
      },
      withdrawalReconciliationCase: { count: vi.fn().mockResolvedValue(0) },
      withdrawalStatusHistory: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };

    mocks.prisma.$transaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => unknown) => cb(tx));
    mocks.resolveWithdrawalOwnerForUser.mockResolvedValue(mockOwner);
    mocks.lockWithdrawalAccounts.mockResolvedValue({
      source: { id: "acc-src", currentBalance: new Prisma.Decimal(500) },
      held: { id: "acc-held", currentBalance: new Prisma.Decimal(0) },
    });
    mocks.postLedgerJournalWithinTransaction.mockResolvedValue({ id: "j-res", reference: "J-RES-1" });

    const req = await createWithdrawalRequest({
      actorUserId: "user-1",
      amount: "100.00",
      payoutDestinationPublicReference: "PD-1",
      operationId: "op-req-12345",
    });

    expect(req.status).toBe("REQUESTED");
    expect(mocks.postLedgerJournalWithinTransaction).toHaveBeenCalled();
  });

  it("rejects withdrawal request when amount exceeds withdrawable balance", async () => {
    const mockOwner = { ownerType: "STORE", ownerId: "store-1", userId: "user-1" };
    const mockWallet = { id: "wallet-1", status: "ACTIVE" };
    const mockPolicy = { enabled: true, ownerType: "STORE", currency: "ZAR", minimumAmount: null, maximumAmount: null, version: 1 };
    const mockDestination = { id: "dest-1", publicReference: "PD-1", walletId: "wallet-1", ownerType: "STORE", ownerId: "store-1", currency: "ZAR", status: "ACTIVE" };

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "wallet-1" }]),
      wallet: { findUnique: vi.fn().mockResolvedValue(mockWallet) },
      withdrawalPolicy: { findUnique: vi.fn().mockResolvedValue(mockPolicy) },
      payoutDestination: { findUnique: vi.fn().mockResolvedValue(mockDestination) },
      withdrawalRequest: { findUnique: vi.fn().mockResolvedValue(null) },
      ledgerAccount: {
        findMany: vi.fn().mockResolvedValue([
          { id: "acc-src", purpose: "OWNER_WITHDRAWABLE" },
          { id: "acc-held", purpose: "WITHDRAWAL_HELD" },
        ]),
      },
    };

    mocks.prisma.$transaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => unknown) => cb(tx));
    mocks.resolveWithdrawalOwnerForUser.mockResolvedValue(mockOwner);
    mocks.lockWithdrawalAccounts.mockResolvedValue({
      source: { id: "acc-src", currentBalance: new Prisma.Decimal(50) },
      held: { id: "acc-held", currentBalance: new Prisma.Decimal(0) },
    });

    await expect(
      createWithdrawalRequest({
        actorUserId: "user-1",
        amount: "100.00",
        payoutDestinationPublicReference: "PD-1",
        operationId: "op-req-overdraw",
      })
    ).rejects.toMatchObject({ code: "WITHDRAWAL_INSUFFICIENT_BALANCE" });
  });

  it("cancels requested withdrawal and restores reserved funds", async () => {
    const mockWithdrawal = {
      id: "wd-1",
      publicReference: "WD-100",
      requestedByUserId: "user-1",
      status: "REQUESTED",
      amount: new Prisma.Decimal(100),
      sourceAccountId: "acc-src",
      heldAccountId: "acc-held",
      policyVersion: 1,
      ownerType: "STORE",
      payoutDestination: { publicReference: "PD-1" },
      releaseLedgerJournalId: null,
      payoutLedgerJournalId: null,
    };

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "wd-1" }]),
      withdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(mockWithdrawal),
        update: vi.fn().mockResolvedValue({ ...mockWithdrawal, status: "CANCELLED" }),
      },
      withdrawalStatusHistory: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };

    mocks.prisma.$transaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => unknown) => cb(tx));
    mocks.lockWithdrawalAccounts.mockResolvedValue({ source: { id: "acc-src" }, held: { id: "acc-held" } });
    mocks.postLedgerJournalWithinTransaction.mockResolvedValue({ id: "j-rel", reference: "J-REL-1" });

    const cancelled = await cancelWithdrawalRequest({
      actorUserId: "user-1",
      publicReference: "WD-100",
      operationId: "op-cancel-12345",
    });

    expect(cancelled.status).toBe("CANCELLED");
    expect(mocks.postLedgerJournalWithinTransaction).toHaveBeenCalled();
  });
});
