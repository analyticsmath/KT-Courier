import { describe, expect, it } from "vitest";
import { LedgerMoney } from "@/lib/ledger/money";

describe("ledger money", () => {
  it("parses exact ZAR values and serializes canonically", () => {
    expect(LedgerMoney.parse("1").toString()).toBe("1.00");
    expect(LedgerMoney.parse("1.2").toString()).toBe("1.20");
    expect(LedgerMoney.parse("9999999999999999.99").toString()).toBe("9999999999999999.99");
  });

  it.each(["0", "0.00", "-1.00", "+1.00", "1e2", " 1.00", "NaN", "Infinity"])("rejects invalid amount %s", (value) => {
    expect(() => LedgerMoney.parse(value)).toThrow();
  });

  it("rejects excessive precision without rounding", () => {
    expect(() => LedgerMoney.parse("1.001")).toThrowError(expect.objectContaining({ code: "LEDGER_PRECISION_EXCEEDED" }));
  });

  it("never accepts native floating-point input", () => {
    expect(() => LedgerMoney.parse(1.25 as never)).toThrowError(expect.objectContaining({ code: "LEDGER_INVALID_AMOUNT" }));
  });

  it("supports immutable exact addition, subtraction, comparison, and equality", () => {
    const left = LedgerMoney.parse("10.10");
    const right = LedgerMoney.parse("2.05");
    expect(left.add(right).toString()).toBe("12.15");
    expect(left.subtract(right).toString()).toBe("8.05");
    expect(left.greaterThan(right)).toBe(true);
    expect(left.equals(LedgerMoney.parse("10.10"))).toBe(true);
    expect(left.toString()).toBe("10.10");
    expect(Object.isFrozen(left)).toBe(true);
  });
});

