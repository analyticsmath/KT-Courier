import { describe, expect, it } from "vitest";
import { normalizeLedgerPosting } from "@/lib/ledger/posting-normalization";
import { validateJournalPolicy } from "@/lib/ledger/journal-policy";
import { postingInput } from "./fixtures";

describe("ledger journal policy", () => {
  it("accepts valid two-entry and balanced multi-entry journals", () => {
    expect(normalizeLedgerPosting(postingInput()).totalDebits.toString()).toBe("100.00");
    const multi = postingInput({ entries: [
      { accountId: "asset-a", direction: "DEBIT", amount: "60.00", lineCode: "A" },
      { accountId: "asset-b", direction: "DEBIT", amount: "40.00", lineCode: "B" },
      { accountId: "equity", direction: "CREDIT", amount: "100.00", lineCode: "C" },
    ] });
    expect(normalizeLedgerPosting(multi).totalCredits.toString()).toBe("100.00");
  });

  it("rejects unbalanced and single-entry journals", () => {
    expect(() => normalizeLedgerPosting(postingInput({ entries: [
      { accountId: "a", direction: "DEBIT", amount: "1.00", lineCode: "A" },
      { accountId: "b", direction: "CREDIT", amount: "2.00", lineCode: "B" },
    ] }))).toThrowError(expect.objectContaining({ code: "LEDGER_UNBALANCED_JOURNAL" }));
    expect(() => normalizeLedgerPosting(postingInput({ entries: [
      { accountId: "a", direction: "DEBIT", amount: "1.00", lineCode: "A" },
    ] }))).toThrowError(expect.objectContaining({ code: "LEDGER_INSUFFICIENT_ENTRIES" }));
  });

  it("rejects duplicate line codes, duplicate account/direction lines, and the same account on both sides", () => {
    expect(() => normalizeLedgerPosting(postingInput({ entries: [
      { accountId: "a", direction: "DEBIT", amount: "1.00", lineCode: "LINE" },
      { accountId: "b", direction: "CREDIT", amount: "1.00", lineCode: "line" },
    ] }))).toThrowError(expect.objectContaining({ code: "LEDGER_DUPLICATE_LINE_CODE" }));
    expect(() => normalizeLedgerPosting(postingInput({ entries: [
      { accountId: "a", direction: "DEBIT", amount: "1.00", lineCode: "A1" },
      { accountId: "a", direction: "DEBIT", amount: "1.00", lineCode: "A2" },
      { accountId: "b", direction: "CREDIT", amount: "2.00", lineCode: "B" },
    ] }))).toThrowError(expect.objectContaining({ code: "LEDGER_DUPLICATE_ACCOUNT_LINE" }));
    expect(() => normalizeLedgerPosting(postingInput({ entries: [
      { accountId: "a", direction: "DEBIT", amount: "1.00", lineCode: "A" },
      { accountId: "a", direction: "CREDIT", amount: "1.00", lineCode: "B" },
    ] }))).toThrow();
  });

  it("rejects mixed currencies at the pure policy boundary", () => {
    const normalized = normalizeLedgerPosting(postingInput());
    const mixed = normalized.entries.map((entry, index) => index ? { ...entry, currency: "USD" as never } : entry);
    expect(() => validateJournalPolicy("ZAR", mixed)).toThrowError(expect.objectContaining({ code: "LEDGER_ACCOUNT_CURRENCY_MISMATCH" }));
  });

  it("does not mutate caller input", () => {
    const input = postingInput();
    const before = JSON.stringify(input);
    normalizeLedgerPosting(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

