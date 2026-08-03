import { describe, expect, it } from "vitest";
import { Decimal, assertNonNegative, decimal, moneyString, roundMoney } from "@/lib/pricing/money";

describe("pricing money", () => {
  it("uses exact Decimal addition, multiplication, and half-up rounding", () => {
    expect(new Decimal("0.10").plus("0.20").toString()).toBe("0.3");
    expect(new Decimal("19.99").mul("3").toString()).toBe("59.97");
    expect(roundMoney(new Decimal("1.005")).toFixed(2)).toBe("1.01");
    expect(moneyString(new Decimal("0"))).toBe("0.00");
  });

  it("rejects native numbers and negative authoritative values", () => {
    expect(() => decimal(1 as never)).toThrow("Native numbers");
    expect(() => assertNonNegative(new Decimal("-0.01"), "fee")).toThrow("cannot be negative");
    expect(decimal("9999999999.9999").toString()).toBe("9999999999.9999");
  });
});
