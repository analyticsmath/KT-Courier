import { describe, expect, it } from "vitest";
import { hashLedgerPosting } from "@/lib/ledger/posting-hash";
import { normalizeLedgerPosting } from "@/lib/ledger/posting-normalization";
import { postingInput } from "./fixtures";

const hash = (overrides = {}) => hashLedgerPosting(normalizeLedgerPosting(postingInput(overrides)));

describe("ledger posting hash", () => {
  it("is property-order and entry-order independent", () => {
    const input = postingInput();
    const metadata = { nested: { safe: true }, fixture: "ledger" };
    expect(hash({ metadata, entries: [...input.entries].reverse() })).toBe(hash());
  });

  it.each([
    { entries: [{ accountId: "account-asset", direction: "DEBIT" as const, amount: "101.00", lineCode: "ASSET" }, { accountId: "account-equity", direction: "CREDIT" as const, amount: "101.00", lineCode: "EQUITY" }] },
    { entries: [{ accountId: "changed", direction: "DEBIT" as const, amount: "100.00", lineCode: "ASSET" }, { accountId: "account-equity", direction: "CREDIT" as const, amount: "100.00", lineCode: "EQUITY" }] },
    { entries: [{ accountId: "account-asset", direction: "CREDIT" as const, amount: "100.00", lineCode: "ASSET" }, { accountId: "account-equity", direction: "DEBIT" as const, amount: "100.00", lineCode: "EQUITY" }] },
    { entries: [{ accountId: "account-asset", direction: "DEBIT" as const, amount: "100.00", lineCode: "CHANGED" }, { accountId: "account-equity", direction: "CREDIT" as const, amount: "100.00", lineCode: "EQUITY" }] },
  ])("changes when financial meaning changes", (overrides) => expect(hash(overrides)).not.toBe(hash()));

  it("excludes unstable timestamps and actor identity", () => {
    expect(hash({ actor: { kind: "SYSTEM" } })).toBe(hash({ actor: { kind: "USER", userId: "actor-one" } }));
  });

  it("rejects sensitive metadata before hashing", () => {
    expect(() => hash({ metadata: { authorizationToken: "unsafe" } })).toThrowError(expect.objectContaining({ code: "LEDGER_METADATA_INVALID" }));
  });
});

