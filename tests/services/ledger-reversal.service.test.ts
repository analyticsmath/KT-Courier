import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  prisma: { ledgerJournal: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/services/ledger-posting.service", () => ({ postLedgerJournal: mocks.post }));

import { reverseLedgerJournal } from "@/lib/services/ledger-reversal.service";

const original = { id: "original", reference: "LJ-ORIGINAL", currency: "ZAR", correlationId: "corr", reversalOfJournalId: null, reversalJournal: null, entries: [
  { accountId: "a", direction: "DEBIT", amount: new Prisma.Decimal(10), lineCode: "A", memo: null },
  { accountId: "b", direction: "CREDIT", amount: new Prisma.Decimal(10), lineCode: "B", memo: null },
] };

beforeEach(() => { vi.clearAllMocks(); mocks.prisma.ledgerJournal.findUnique.mockResolvedValue(original); mocks.post.mockResolvedValue({ id: "reversal" }); });

describe("ledger reversal service", () => {
  it("posts exact inverse entries with source linkage and leaves the original untouched", async () => {
    const before = JSON.stringify(original);
    await reverseLedgerJournal({ originalJournalId: "original", idempotencyKey: "reverse-1", actor: { kind: "SYSTEM" } });
    expect(mocks.post).toHaveBeenCalledWith(expect.objectContaining({ type: "REVERSAL", reversalOfJournalId: "original", sourceReference: "REVERSAL:LJ-ORIGINAL", entries: [
      expect.objectContaining({ accountId: "a", direction: "CREDIT", amount: "10.00" }),
      expect.objectContaining({ accountId: "b", direction: "DEBIT", amount: "10.00" }),
    ] }));
    expect(JSON.stringify(original)).toBe(before);
  });

  it("rejects missing, already-reversed, and reversal journals", async () => {
    mocks.prisma.ledgerJournal.findUnique.mockResolvedValue(null);
    await expect(reverseLedgerJournal({ originalJournalId: "missing", idempotencyKey: "x", actor: { kind: "SYSTEM" } })).rejects.toMatchObject({ code: "LEDGER_JOURNAL_NOT_FOUND" });
    mocks.prisma.ledgerJournal.findUnique.mockResolvedValue({ ...original, reversalJournal: { id: "r", idempotencyKey: "other" } });
    await expect(reverseLedgerJournal({ originalJournalId: "original", idempotencyKey: "x", actor: { kind: "SYSTEM" } })).rejects.toMatchObject({ code: "LEDGER_JOURNAL_ALREADY_REVERSED" });
    mocks.prisma.ledgerJournal.findUnique.mockResolvedValue({ ...original, reversalOfJournalId: "first" });
    await expect(reverseLedgerJournal({ originalJournalId: "original", idempotencyKey: "x", actor: { kind: "SYSTEM" } })).rejects.toMatchObject({ code: "LEDGER_REVERSAL_NOT_ALLOWED" });
  });

  it("delegates same-key reversal replay to the posting receipt", async () => {
    mocks.prisma.ledgerJournal.findUnique.mockResolvedValue({ ...original, reversalJournal: { id: "r", idempotencyKey: "reverse-1" } });
    await expect(reverseLedgerJournal({ originalJournalId: "original", idempotencyKey: "reverse-1", actor: { kind: "SYSTEM" } })).resolves.toMatchObject({ id: "reversal" });
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });
});
