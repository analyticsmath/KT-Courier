import { describe, expect, it } from "vitest";
import { formatZarLedgerAmount } from "@/lib/ledger/format";

describe("ledger ZAR display", () => {
  it("formats canonical decimal strings without floating-point conversion", () => {
    expect(formatZarLedgerAmount("1234567.89")).toBe("ZAR\u00A01 234 567,89");
    expect(formatZarLedgerAmount("-10.00")).toBe("−ZAR\u00A010,00");
  });

  it("fails visibly rather than inventing a value for a malformed server string", () => {
    expect(formatZarLedgerAmount("bad")).toBe("ZAR bad");
  });
});

