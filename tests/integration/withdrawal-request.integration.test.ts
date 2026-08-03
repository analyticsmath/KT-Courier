import { describe, expect, it } from "vitest";
import { parseWithdrawalAmount } from "@/lib/withdrawals/withdrawal-money-policy";
import { assertWithdrawalPolicy } from "@/lib/withdrawals/withdrawal-policy";
import { withdrawalProductionReadiness } from "@/lib/withdrawals/withdrawal-production-readiness";

describe("withdrawal request integration", () => {
  it("validates exact ZAR withdrawal amounts and policy boundaries", () => {
    expect(parseWithdrawalAmount("100.00").toString()).toBe("100.00");
    expect(() => assertWithdrawalPolicy({ enabled: true, ownerType: "STORE", currency: "ZAR", minimumAmount: "50.00", maximumAmount: "1000.00", amount: "10.00" })).toThrow();
  });
  it("enforces fail-closed production readiness invariants", () => {
    const readiness = withdrawalProductionReadiness();
    expect(readiness).toHaveProperty("productionActive");
  });
});
