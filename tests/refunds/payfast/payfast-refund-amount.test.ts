import { describe, expect, it } from "vitest";
import { PAYFAST_REFUND_AMOUNT_PROTOCOL_REVIEWED, PAYFAST_REFUND_AMOUNT_UNIT, serializePayfastRefundAmount, validateRefundAmountForProtocol } from "@/lib/refunds/providers/payfast/payfast-refund-amount";

describe("Payfast refund amount contract", () => {
  it("records the protocol ambiguity explicitly", () => { expect(PAYFAST_REFUND_AMOUNT_UNIT).toBe("UNRESOLVED"); expect(PAYFAST_REFUND_AMOUNT_PROTOCOL_REVIEWED).toBe(false); });
  it("accepts exact Decimal evidence without choosing rands or cents", () => expect(validateRefundAmountForProtocol("10.01").toFixed(2)).toBe("10.01"));
  it("fails closed rather than guessing an amount unit", () => expect(() => serializePayfastRefundAmount("10.01")).toThrow(/units are unresolved/i));
  it.each(["0", "-1", "1.001", "NaN"])("rejects invalid amount %s", (amount) => expect(() => validateRefundAmountForProtocol(amount)).toThrow(/exact positive/i));
});
