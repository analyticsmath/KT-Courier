import { describe, expect, it } from "vitest";
import { sanitizeLedgerMetadata } from "@/lib/ledger/metadata";

describe("ledger metadata policy", () => {
  it("accepts, sorts, and freezes a bounded safe object", () => {
    const metadata = sanitizeLedgerMetadata({ z: "last", a: { safe: true } });
    expect(Object.keys(metadata ?? {})).toEqual(["a", "z"]);
    expect(Object.isFrozen(metadata)).toBe(true);
  });

  it.each(["password", "accessToken", "authorization", "bankDetails", "otpCode", "privateNote", "requestBody"])("rejects sensitive key %s", (key) => {
    expect(() => sanitizeLedgerMetadata({ [key]: "unsafe" })).toThrowError(expect.objectContaining({ code: "LEDGER_METADATA_INVALID" }));
  });

  it("rejects non-object, excessive depth, and excessive size", () => {
    expect(() => sanitizeLedgerMetadata(["not", "object"])).toThrow();
    expect(() => sanitizeLedgerMetadata({ a: { b: { c: { d: "too deep" } } } })).toThrow();
    expect(() => sanitizeLedgerMetadata({ note: "x".repeat(3000) })).toThrow();
  });
});

