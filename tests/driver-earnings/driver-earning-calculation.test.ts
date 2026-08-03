import { expect, it } from "vitest";
import { parseDriverEarningMoney } from "@/lib/driver-earnings/driver-earning-money";
it("uses Decimal exact cents", () => expect(parseDriverEarningMoney("100.00").sub(parseDriverEarningMoney("10.00")).toFixed(2)).toBe("90.00"));
it("rejects floating or noncanonical input", () => expect(() => parseDriverEarningMoney("0.1")).toThrow());
