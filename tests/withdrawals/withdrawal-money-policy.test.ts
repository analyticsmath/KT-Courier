import { describe, expect, it } from "vitest";
import {
  parseWithdrawalAmount,
  assertWithdrawalPolicyAmount,
} from "@/lib/withdrawals/withdrawal-money-policy";

describe("withdrawal money policy", () => {
  it("covers exact decimal parsing and no floating point input", () => {
    const parsed = parseWithdrawalAmount("150.50");
    expect(parsed.toString()).toBe("150.50");
    expect(parsed.toDecimal().toFixed(2)).toBe("150.50");

    expect(() => parseWithdrawalAmount("invalid-amount")).toThrowError(/valid positive ZAR decimal/);
    expect(() => parseWithdrawalAmount("-50.00")).toThrowError();

    // Policy limits checking
    expect(() =>
      assertWithdrawalPolicyAmount({
        amount: parsed,
        minimumAmount: "200.00",
        maximumAmount: "1000.00",
      })
    ).toThrowError(/below/);

    expect(() =>
      assertWithdrawalPolicyAmount({
        amount: parsed,
        minimumAmount: "50.00",
        maximumAmount: "100.00",
      })
    ).toThrowError(/exceeds/);

    expect(() =>
      assertWithdrawalPolicyAmount({
        amount: parsed,
        minimumAmount: "100.00",
        maximumAmount: "500.00",
      })
    ).not.toThrow();
  });
});
