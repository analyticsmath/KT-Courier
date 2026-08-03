import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildReversalEntries } from "@/lib/ledger/reversal-policy";

const original = () => ({
  reversalOfJournalId: null,
  reversalJournal: null,
  entries: [
    { accountId: "a", direction: "DEBIT" as const, amount: new Prisma.Decimal("10.00"), lineCode: "A", memo: null },
    { accountId: "b", direction: "CREDIT" as const, amount: new Prisma.Decimal("10.00"), lineCode: "B", memo: "Original" },
  ],
});

describe("ledger reversal policy", () => {
  it("inverts directions while preserving account, amount, currency context, and original input", () => {
    const journal = original();
    const before = JSON.stringify(journal);
    const inverse = buildReversalEntries(journal);
    expect(inverse.map((entry) => entry.direction)).toEqual(["CREDIT", "DEBIT"]);
    expect(inverse.map((entry) => entry.amount)).toEqual(["10.00", "10.00"]);
    expect(inverse.map((entry) => entry.accountId)).toEqual(["a", "b"]);
    expect(JSON.stringify(journal)).toBe(before);
  });

  it("rejects reversal of reversal and a second direct reversal", () => {
    expect(() => buildReversalEntries({ ...original(), reversalOfJournalId: "first" })).toThrowError(expect.objectContaining({ code: "LEDGER_REVERSAL_NOT_ALLOWED" }));
    expect(() => buildReversalEntries({ ...original(), reversalJournal: { id: "reversal" } })).toThrowError(expect.objectContaining({ code: "LEDGER_JOURNAL_ALREADY_REVERSED" }));
  });
});

