import { describe, expect, it } from "vitest";
import { parseRefundAmount } from "@/lib/refunds/refund-money-policy";

describe("refund money policy", () => {
  it("normalizes exact decimal strings", () => expect(parseRefundAmount("12.3").toString()).toBe("12.30"));
  it.each(["0", "-1.00", "1.001", "1e2", " 1.00", "NaN"])("rejects %s", (value) => expect(() => parseRefundAmount(value)).toThrow(/exact positive ZAR/i));
});
