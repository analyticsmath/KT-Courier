import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    user: { findFirst: vi.fn() }, store: { findUnique: vi.fn() }, driverProfile: { findUnique: vi.fn() }, promoterProfile: { findUnique: vi.fn() },
    wallet: { findUnique: vi.fn(), create: vi.fn() },
    ledgerAccount: { findUnique: vi.fn(), create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      wallet: { findUnique: vi.fn() },
      ledgerAccount: { findUnique: vi.fn() },
    },
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));

import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";

const wallet = { id: "wallet", ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE", version: 0, createdAt: new Date(), updatedAt: new Date() };
const account = { id: "account", walletId: "wallet", code: "PLATFORM-CASH-ZAR", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR", status: "ACTIVE", allowNegative: false, currentBalance: new Prisma.Decimal(0), debitTotal: new Prisma.Decimal(0), creditTotal: new Prisma.Decimal(0), version: 0, createdAt: new Date(), updatedAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
});

describe("wallet and account provisioning", () => {
  it("creates a valid owner wallet once with zero-only schema defaults", async () => {
    mocks.tx.wallet.findUnique.mockResolvedValue(null);
    mocks.tx.wallet.create.mockResolvedValue(wallet);
    await expect(ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" })).resolves.toMatchObject({ id: "wallet" });
    expect(mocks.tx.wallet.create).toHaveBeenCalledWith({ data: expect.not.objectContaining({ availableBalance: expect.anything(), pendingBalance: expect.anything(), lockedBalance: expect.anything() }) });
  });

  it("returns the unique-race winner rather than creating a second wallet", async () => {
    mocks.prisma.$transaction.mockRejectedValue({ code: "P2002" });
    mocks.prisma.wallet.findUnique.mockResolvedValue(wallet);
    await expect(ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" })).resolves.toMatchObject({ id: "wallet" });
  });

  it("rejects an invalid owner and inactive wallet", async () => {
    await expect(ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "not-platform", currency: "ZAR" })).rejects.toMatchObject({ code: "LEDGER_OWNER_INVALID" });
    mocks.tx.wallet.findUnique.mockResolvedValue({ ...wallet, status: "ARCHIVED" });
    await expect(ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" })).rejects.toMatchObject({ code: "LEDGER_WALLET_INACTIVE" });
  });

  it("creates one stable zero-balance account and prevents conflicting purpose definitions", async () => {
    mocks.tx.wallet.findUnique.mockResolvedValue(wallet);
    mocks.tx.ledgerAccount.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.tx.ledgerAccount.create.mockResolvedValue(account);
    await expect(ensureLedgerAccount({ walletId: "wallet", code: "platform-cash-zar", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" })).resolves.toMatchObject({ currentBalance: "0.00" });
    expect(mocks.tx.ledgerAccount.create).toHaveBeenCalledWith({ data: expect.objectContaining({ allowNegative: false }) });

    mocks.tx.ledgerAccount.findUnique.mockReset().mockResolvedValueOnce({ ...account, code: "OTHER" });
    await expect(ensureLedgerAccount({ walletId: "wallet", code: "platform-cash-zar", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" })).rejects.toMatchObject({ code: "LEDGER_OWNER_INVALID" });
  });
});

