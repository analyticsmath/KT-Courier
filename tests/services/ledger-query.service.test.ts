import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    ledgerAccount: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    ledgerEntry: { count: vi.fn(), findMany: vi.fn() },
    ledgerJournal: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    user: { findMany: vi.fn() }, store: { findMany: vi.fn() }, driverProfile: { findMany: vi.fn() }, promoterProfile: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));

import { getLedgerJournalDetail, listLedgerAccounts, listLedgerJournals } from "@/lib/services/ledger-query.service";

const account = { id: "a", walletId: "w", code: "ACCOUNT", purpose: "AVAILABLE", category: "ASSET", currency: "ZAR", status: "ACTIVE", allowNegative: false, currentBalance: new Prisma.Decimal("1.00"), debitTotal: new Prisma.Decimal("1.00"), creditTotal: new Prisma.Decimal(0), version: 1, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), wallet: { ownerType: "PLATFORM", ownerId: "platform" } };
const journal = { id: "j", reference: "LJ-1", type: "GENERAL", currency: "ZAR", totalDebits: new Prisma.Decimal("1.00"), totalCredits: new Prisma.Decimal("1.00"), sourceReference: null, correlationId: null, postedAt: new Date("2026-01-01"), originalJournal: null, reversalJournal: null };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
  mocks.prisma.user.findMany.mockResolvedValue([]); mocks.prisma.store.findMany.mockResolvedValue([]); mocks.prisma.driverProfile.findMany.mockResolvedValue([]); mocks.prisma.promoterProfile.findMany.mockResolvedValue([]);
});

describe("ledger query service", () => {
  it("returns deterministic account pagination, safe owners, and string money", async () => {
    mocks.prisma.ledgerAccount.count.mockResolvedValue(1); mocks.prisma.ledgerAccount.findMany.mockResolvedValue([account]);
    const result = await listLedgerAccounts({ page: 1, pageSize: 20 });
    expect(result.data[0]).toMatchObject({ currentBalance: "1.00", owner: { label: "KT Couriers platform" } });
    expect(mocks.prisma.ledgerAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ code: "asc" }, { id: "asc" }] }));
  });

  it("returns server-derived journal balancing and stable ordering", async () => {
    mocks.prisma.ledgerJournal.count.mockResolvedValue(1); mocks.prisma.ledgerJournal.findMany.mockResolvedValue([journal]);
    const result = await listLedgerJournals({ page: 1, pageSize: 20 });
    expect(result.data[0]).toMatchObject({ totalDebits: "1.00", totalCredits: "1.00", balanced: true });
    expect(mocks.prisma.ledgerJournal.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ postedAt: "desc" }, { id: "desc" }] }));
  });

  it("redacts unsafe stored metadata and never exposes a request hash", async () => {
    mocks.prisma.ledgerJournal.findUnique.mockResolvedValue({ ...journal, memo: null, policyVersion: "phase9-v1", requestHash: "secret-hash", metadata: { password: "unsafe" }, entries: [] });
    const result = await getLedgerJournalDetail("j");
    expect(result).toMatchObject({ metadata: null, metadataRedacted: true });
    expect(result).not.toHaveProperty("requestHash");
  });
});
