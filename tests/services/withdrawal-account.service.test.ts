import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    wallet: { findUnique: vi.fn() },
  },
  ensureLedgerAccount: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/services/wallet-account.service", () => ({ ensureLedgerAccount: mocks.ensureLedgerAccount }));

import { Prisma } from "@prisma/client";
import { ensureWithdrawalAccounts, lockWithdrawalAccounts } from "@/lib/services/withdrawal-account.service";

describe("withdrawal account service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("covers idempotent owner account provisioning and unique races", async () => {
    mocks.prisma.wallet.findUnique.mockResolvedValue({
      id: "wallet-1",
      ownerType: "STORE",
      status: "ACTIVE",
      currency: "ZAR",
    });

    mocks.ensureLedgerAccount
      .mockResolvedValueOnce({ id: "acc-src", purpose: "OWNER_WITHDRAWABLE" })
      .mockResolvedValueOnce({ id: "acc-held", purpose: "WITHDRAWAL_HELD" });

    const res = await ensureWithdrawalAccounts({ walletId: "wallet-1", ownerType: "STORE" });

    expect(res).toEqual({ sourceAccountId: "acc-src", heldAccountId: "acc-held" });
    expect(mocks.ensureLedgerAccount).toHaveBeenCalledTimes(2);
  });

  it("locks withdrawal accounts securely within a transaction", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "acc-held" }, { id: "acc-src" }]),
      ledgerAccount: {
        findMany: vi.fn().mockResolvedValue([
          { id: "acc-held", walletId: "wallet-1", purpose: "WITHDRAWAL_HELD", category: "LIABILITY", status: "ACTIVE", allowNegative: false },
          { id: "acc-src", walletId: "wallet-1", purpose: "OWNER_WITHDRAWABLE", category: "LIABILITY", status: "ACTIVE", allowNegative: false },
        ]),
      },
    };

    const locked = await lockWithdrawalAccounts(tx as unknown as Prisma.TransactionClient, {
      walletId: "wallet-1",
      sourceAccountId: "acc-src",
      heldAccountId: "acc-held",
    });

    expect(locked.source.id).toBe("acc-src");
    expect(locked.held.id).toBe("acc-held");
  });

  it("rejects inactive or mismatched owner wallets", async () => {
    mocks.prisma.wallet.findUnique.mockResolvedValue({
      id: "wallet-1",
      ownerType: "DRIVER",
      status: "SUSPENDED",
      currency: "ZAR",
    });

    await expect(
      ensureWithdrawalAccounts({ walletId: "wallet-1", ownerType: "DRIVER" })
    ).rejects.toMatchObject({ code: "LEDGER_WALLET_INACTIVE" });
  });
});
