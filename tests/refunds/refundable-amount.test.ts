import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { assertRefundWithinRemaining, calculateRemainingRefundableAmount } from "@/lib/refunds/refundable-amount";

describe("remaining refundable amount", () => {
  it("subtracts successful and all reserved states, but not released terminal requests", () => {
    const remaining = calculateRemainingRefundableAmount("100.00", [
      { amount: "10.00", status: "SUCCEEDED" }, { amount: "20.00", status: "REQUESTED" },
      { amount: "5.00", status: "RECONCILIATION_REQUIRED" }, { amount: "9.00", status: "CANCELLED" },
    ]);
    expect(remaining.toFixed(2)).toBe("65.00");
  });
  it("rejects incoherent over-refund evidence", () => expect(() => calculateRemainingRefundableAmount("10.00", [{ amount: "10.01", status: "SUCCEEDED" }])).toThrow(/exceeds/i));
  it("rejects a one-cent over-request", () => expect(() => assertRefundWithinRemaining(new Prisma.Decimal("10.01"), new Prisma.Decimal("10.00"))).toThrow(/exceeds/i));
});
