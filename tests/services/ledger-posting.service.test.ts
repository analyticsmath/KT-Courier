import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn() },
    ledgerJournal: { findUnique: vi.fn(), create: vi.fn() },
    ledgerEntry: { createMany: vi.fn() },
    ledgerAccount: { findMany: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      ledgerJournal: { findUnique: vi.fn() },
    },
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));

import { postLedgerJournal } from "@/lib/services/ledger-posting.service";

const decimal = (value: string | number) => new Prisma.Decimal(value);
const accounts = (overrides: Record<string, unknown> = {}) => [
  { id: "asset", category: "ASSET", currency: "ZAR", status: "ACTIVE", allowNegative: false, currentBalance: decimal(0), debitTotal: decimal(0), creditTotal: decimal(0), version: 0, wallet: { id: "wallet", ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" }, ...overrides },
  { id: "equity", category: "EQUITY", currency: "ZAR", status: "ACTIVE", allowNegative: false, currentBalance: decimal(0), debitTotal: decimal(0), creditTotal: decimal(0), version: 0, wallet: { id: "wallet", ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" } },
];
const journal = (requestHash = "a".repeat(64)) => ({
  id: "journal", reference: "LJ-TEST", type: "GENERAL", currency: "ZAR", idempotencyKey: "posting-1", requestHash,
  sourceReference: "TEST:SOURCE-1", correlationId: null, memo: null, metadata: null, policyVersion: "phase9-v1",
  totalDebits: decimal(10), totalCredits: decimal(10), reversalOfJournalId: null, postedAt: new Date("2026-01-01"), createdAt: new Date("2026-01-01"),
  originalJournal: null, reversalJournal: null,
  entries: [
    { id: "entry-1", sequence: 1, accountId: "asset", direction: "DEBIT", amount: decimal(10), lineCode: "ASSET", memo: null, createdAt: new Date("2026-01-01"), account: { id: "asset", code: "ASSET", purpose: "AVAILABLE", category: "ASSET" } },
    { id: "entry-2", sequence: 2, accountId: "equity", direction: "CREDIT", amount: decimal(10), lineCode: "EQUITY", memo: null, createdAt: new Date("2026-01-01"), account: { id: "equity", code: "EQUITY", purpose: "ADJUSTMENT", category: "EQUITY" } },
  ],
});
const input = () => ({ idempotencyKey: "posting-1", type: "GENERAL" as const, currency: "ZAR" as const, sourceReference: "test:source-1", actor: { kind: "SYSTEM" as const }, entries: [
  { accountId: "asset", direction: "DEBIT" as const, amount: "10.00", lineCode: "ASSET" },
  { accountId: "equity", direction: "CREDIT" as const, amount: "10.00", lineCode: "EQUITY" },
] });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx.ledgerJournal.findUnique.mockReset();
  mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
  mocks.tx.$queryRaw.mockResolvedValue([{ id: "asset" }, { id: "equity" }]);
  mocks.tx.ledgerAccount.findMany.mockResolvedValue(accounts());
  mocks.tx.ledgerAccount.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.ledgerEntry.createMany.mockResolvedValue({ count: 2 });
  mocks.tx.ledgerJournal.create.mockResolvedValue({ id: "journal" });
  mocks.tx.ledgerJournal.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(journal());
});

describe("ledger posting service", () => {
  it("locks sorted accounts, creates one balanced journal and entries, and atomically updates projections", async () => {
    const callerInput = input();
    const before = JSON.stringify(callerInput);
    const result = await postLedgerJournal(callerInput);
    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.tx.ledgerJournal.create).toHaveBeenCalledTimes(1);
    expect(mocks.tx.ledgerEntry.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([expect.objectContaining({ sequence: 1 }), expect.objectContaining({ sequence: 2 })]) });
    expect(mocks.tx.ledgerAccount.updateMany).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ totalDebits: "10.00", totalCredits: "10.00", balanced: true });
    expect(result.entries[0].amount).toBe("10.00");
    expect(JSON.stringify(callerInput)).toBe(before);
  });

  it("replays the same idempotency hash and conflicts on a changed hash", async () => {
    const firstResult = await postLedgerJournal(input());
    const hash = mocks.tx.ledgerJournal.create.mock.calls[0][0].data.requestHash;
    expect(firstResult.id).toBe("journal");

    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.tx.ledgerJournal.findUnique.mockResolvedValue(journal(hash));
    await expect(postLedgerJournal(input())).resolves.toMatchObject({ id: "journal" });
    expect(mocks.tx.ledgerEntry.createMany).not.toHaveBeenCalled();

    mocks.tx.ledgerJournal.findUnique.mockResolvedValue(journal("b".repeat(64)));
    await expect(postLedgerJournal(input())).rejects.toMatchObject({ code: "LEDGER_IDEMPOTENCY_CONFLICT" });
  });

  it.each([
    [{ status: "FROZEN" }, "LEDGER_ACCOUNT_FROZEN"],
    [{ status: "CLOSED" }, "LEDGER_ACCOUNT_CLOSED"],
    [{ currency: "USD" }, "LEDGER_ACCOUNT_CURRENCY_MISMATCH"],
    [{ currentBalance: decimal(0) }, "LEDGER_INSUFFICIENT_BALANCE", true],
  ])("rejects semantic account policy failures", async (override, code, useCredit = false) => {
    mocks.tx.ledgerAccount.findMany.mockResolvedValue(accounts(override));
    const request = input();
    if (useCredit) request.entries[0] = { ...request.entries[0], direction: "CREDIT" } as never;
    if (useCredit) request.entries[1] = { ...request.entries[1], direction: "DEBIT" } as never;
    await expect(postLedgerJournal(request)).rejects.toMatchObject({ code });
    expect(mocks.tx.ledgerJournal.create).not.toHaveBeenCalled();
  });

  it("rejects invalid precision before starting a transaction", async () => {
    const request = input();
    request.entries[0] = { ...request.entries[0], amount: "10.001" };
    await expect(postLedgerJournal(request)).rejects.toMatchObject({ code: "LEDGER_PRECISION_EXCEEDED" });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("propagates a projection failure so the transaction contract rolls back the journal and entries", async () => {
    mocks.tx.ledgerAccount.updateMany.mockRejectedValue(new Error("injected projection failure"));
    await expect(postLedgerJournal(input())).rejects.toThrow("injected projection failure");
    expect(mocks.tx.ledgerJournal.create).toHaveBeenCalled();
    expect(mocks.tx.ledgerEntry.createMany).toHaveBeenCalled();
  });
});
