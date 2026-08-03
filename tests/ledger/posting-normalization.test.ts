import { describe, expect, it } from "vitest";
import { normalizeLedgerPosting } from "@/lib/ledger/posting-normalization";
import { postingInput } from "./fixtures";

describe("posting normalization", () => {
  it("normalizes references, line codes, fixed money, and deterministic line order", () => {
    const normalized = normalizeLedgerPosting(postingInput({
      sourceReference: "  namespace:source-one ",
      entries: [
        { accountId: "z-account", direction: "CREDIT", amount: "1", lineCode: "credit" },
        { accountId: "a-account", direction: "DEBIT", amount: "1.0", lineCode: "debit" },
      ],
    }));
    expect(normalized.sourceReference).toBe("NAMESPACE:SOURCE-ONE");
    expect(normalized.entries.map((entry) => entry.accountId)).toEqual(["a-account", "z-account"]);
    expect(normalized.entries.map((entry) => entry.lineCode)).toEqual(["DEBIT", "CREDIT"]);
    expect(normalized.entries.map((entry) => entry.amount.toString())).toEqual(["1.00", "1.00"]);
  });

  it("rejects non-namespaced sourceReference formats", () => {
    expect(() =>
      normalizeLedgerPosting(postingInput({ sourceReference: "no-colon" }))
    ).toThrowError(/sourceReference must use a canonical namespaced format/);

    expect(() =>
      normalizeLedgerPosting(postingInput({ sourceReference: "colon-at-end:" }))
    ).toThrowError(/sourceReference must use a canonical namespaced format/);

    expect(() =>
      normalizeLedgerPosting(postingInput({ sourceReference: ":colon-at-start" }))
    ).toThrowError(/sourceReference must use a canonical namespaced format/);
  });

  it("is independent of input entry order", () => {
    const input = postingInput();
    const reversed = postingInput({ entries: [...input.entries].reverse() });
    expect(normalizeLedgerPosting(input).entries.map((entry) => entry.accountId)).toEqual(
      normalizeLedgerPosting(reversed).entries.map((entry) => entry.accountId)
    );
  });
});

