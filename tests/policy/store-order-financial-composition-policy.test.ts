import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { splitFrozenCommissionAdjustmentCents } from "@/lib/store-orders/financial-adjustment-composition";

describe("store-order financial composition policy", () => {
  const allocation = (publicReference: string, amount: string) => ({ publicReference, amount: new Prisma.Decimal(amount) });

  it("allocates exact cents deterministically from frozen commission evidence", () => {
    const result = splitFrozenCommissionAdjustmentCents(new Prisma.Decimal("0.05"), [allocation("cca_b", "0.02"), allocation("cca_a", "0.01"), allocation("cca_c", "0.02")]);
    expect(result.map((item) => [item.publicReference, item.amount.toFixed(2)])).toEqual([["cca_a", "0.01"], ["cca_b", "0.02"], ["cca_c", "0.02"]]);
    expect(result.reduce((total, item) => total.add(item.amount), new Prisma.Decimal(0)).toFixed(2)).toBe("0.05");
  });

  it("gives the final frozen allocation the residual cent", () => {
    const result = splitFrozenCommissionAdjustmentCents(new Prisma.Decimal("0.01"), [allocation("cca_a", "0.01"), allocation("cca_b", "0.01")]);
    expect(result.map((item) => item.amount.toFixed(2))).toEqual(["0.00", "0.01"]);
  });

  it("rejects a negative reversal amount", () => {
    expect(() => splitFrozenCommissionAdjustmentCents(new Prisma.Decimal("-0.01"), [allocation("cca_a", "1.00")])).toThrow("Frozen commission allocation");
  });

  it("rejects an empty or zero frozen allocation denominator", () => {
    expect(() => splitFrozenCommissionAdjustmentCents(new Prisma.Decimal("0.01"), [])).toThrow("Frozen commission allocation");
    expect(() => splitFrozenCommissionAdjustmentCents(new Prisma.Decimal("0.01"), [allocation("cca_a", "0.00")])).toThrow("Frozen commission allocation");
  });
});
