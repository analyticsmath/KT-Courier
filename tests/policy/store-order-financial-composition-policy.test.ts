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

  it("never decreases a frozen recipient when a cumulative refund crosses a rounding boundary", () => {
    const components = [allocation("cca_a", "0.01"), allocation("cca_b", "0.01"), allocation("cca_c", "0.01")];
    const one = splitFrozenCommissionAdjustmentCents(new Prisma.Decimal("0.01"), components);
    const two = splitFrozenCommissionAdjustmentCents(new Prisma.Decimal("0.02"), components);
    const three = splitFrozenCommissionAdjustmentCents(new Prisma.Decimal("0.03"), components);
    expect(one.map(row => row.amount.toFixed(2))).toEqual(["0.00", "0.00", "0.01"]);
    expect(two.map(row => row.amount.toFixed(2))).toEqual(["0.00", "0.01", "0.01"]);
    expect(three.map(row => row.amount.toFixed(2))).toEqual(["0.01", "0.01", "0.01"]);
  });

  it("conserves every cent, observes every source ceiling and is monotonic for unequal frozen weights", () => {
    const components = [allocation("cca_a", "0.09"), allocation("cca_b", "0.04"), allocation("cca_c", "0.02")];
    let previous = components.map(() => new Prisma.Decimal(0));
    for (let cents = 0; cents <= 15; cents++) {
      const result = splitFrozenCommissionAdjustmentCents(new Prisma.Decimal(cents).div(100), components);
      expect(result.reduce((value, row) => value.add(row.amount), new Prisma.Decimal(0)).mul(100).toNumber()).toBe(cents);
      for (let index = 0; index < result.length; index++) {
        expect(result[index].amount.greaterThanOrEqualTo(previous[index])).toBe(true);
        expect(result[index].amount.lessThanOrEqualTo(components[index].amount)).toBe(true);
      }
      previous = result.map(row => row.amount);
    }
  });

  it("allocates large exact values without enumerating cents", () => {
    const result = splitFrozenCommissionAdjustmentCents(new Prisma.Decimal("9000000000000000.00"), [allocation("cca_a", "3000000000000000.00"), allocation("cca_b", "3000000000000000.00"), allocation("cca_c", "3000000000000000.00")]);
    expect(result.map(row => row.amount.toFixed(2))).toEqual(["3000000000000000.00", "3000000000000000.00", "3000000000000000.00"]);
  });

  it("rejects over-ceiling, fractional-cent, negative component and duplicate source evidence", () => {
    expect(() => splitFrozenCommissionAdjustmentCents(new Prisma.Decimal("0.02"), [allocation("cca_a", "0.01")])).toThrow("Frozen commission allocation");
    expect(() => splitFrozenCommissionAdjustmentCents(new Prisma.Decimal("0.001"), [allocation("cca_a", "1.00")])).toThrow("Frozen commission allocation");
    expect(() => splitFrozenCommissionAdjustmentCents(new Prisma.Decimal("0.01"), [allocation("cca_a", "-0.01"), allocation("cca_b", "1.00")])).toThrow("Frozen commission allocation");
    expect(() => splitFrozenCommissionAdjustmentCents(new Prisma.Decimal("0.01"), [allocation("cca_a", "0.01"), allocation("cca_a", "0.01")])).toThrow("Frozen commission allocation");
  });
});
