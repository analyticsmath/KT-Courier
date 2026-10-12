import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({
  prisma: {
    wallet: { findUnique: vi.fn() },
    ledgerAccount: { findFirst: vi.fn() },
  },
  ensureLedgerAccount: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/services/wallet-account.service", () => ({ ensureLedgerAccount: mocks.ensureLedgerAccount }));

import { Prisma } from "@prisma/client";
import { ensureOwnerWithdrawableAccount, ensureWithdrawalAccounts, lockWithdrawalAccounts } from "@/lib/services/withdrawal-account.service";

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

  it.each(["driver", "withdrawal", "unknown"])("preserves canonical %s driver account identity while refusing arbitrary definitions", async identity => {
    const wallet = { id: "wallet-driver", ownerType: "DRIVER", ownerId: "driver-profile" };
    const driverCode = `DRIVER-${createHash("sha256").update(wallet.ownerId).digest("hex").slice(0, 20).toUpperCase()}-OWNER-WITHDRAWABLE-ZAR`;
    const withdrawalCode = "OWN-WD-WALLET-DRIVER";
    mocks.prisma.ledgerAccount.findFirst.mockResolvedValue({ code: identity === "driver" ? driverCode : identity === "withdrawal" ? withdrawalCode : "ARBITRARY" });
    mocks.ensureLedgerAccount.mockImplementation(async definition => {
      if (identity === "unknown") throw Object.assign(new Error("Canonical definition conflict"), { code: "LEDGER_OWNER_INVALID" });
      return { id: "source", ...definition };
    });
    const result = ensureOwnerWithdrawableAccount(wallet);
    if (identity === "unknown") await expect(result).rejects.toMatchObject({ code: "LEDGER_OWNER_INVALID" });
    else expect((await result).code).toBe(identity === "driver" ? driverCode : withdrawalCode);
    expect(mocks.ensureLedgerAccount).toHaveBeenCalledWith(expect.objectContaining({ code: identity === "withdrawal" ? withdrawalCode : driverCode, purpose: "OWNER_WITHDRAWABLE", category: "LIABILITY", currency: "ZAR" }));
  });
});
