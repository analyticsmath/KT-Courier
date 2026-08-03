import { describe, expect, it } from "vitest";
import { formatStoreEarningMoney, parseStoreEarningMoney } from "@/lib/store-earnings/store-earning-money";

describe("store earning Decimal calculation", () => {
  it("subtracts commission without basis-point or floating-point arithmetic", () => expect(formatStoreEarningMoney(parseStoreEarningMoney("100.00").sub(parseStoreEarningMoney("10.01")))).toBe("89.99"));
  it.each(["1e2", "0.001", "NaN", "-1.00", "01.00"])("rejects non-canonical money %s", (value) => expect(() => parseStoreEarningMoney(value)).toThrow());
  it("allows explicit zero only for projections", () => expect(parseStoreEarningMoney("0", { allowZero: true }).isZero()).toBe(true));
});
