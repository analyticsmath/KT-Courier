import { describe, expect, it } from "vitest";
import { assertWithdrawalPolicy } from "@/lib/withdrawals/withdrawal-policy";

describe("withdrawal policy", () => {
  it("covers disabled policies and exact limits", () => {
    expect(() =>
      assertWithdrawalPolicy({
        enabled: true,
        ownerType: "STORE",
        currency: "ZAR",
        minimumAmount: "100.00",
        maximumAmount: "5000.00",
        amount: "250.00",
      })
    ).not.toThrow();

    expect(() =>
      assertWithdrawalPolicy({
        enabled: false,
        ownerType: "STORE",
        currency: "ZAR",
        minimumAmount: "100.00",
        maximumAmount: "5000.00",
        amount: "250.00",
      })
    ).toThrowError(/not enabled/);

    expect(() =>
      assertWithdrawalPolicy({
        enabled: true,
        ownerType: "STORE",
        currency: "USD",
        minimumAmount: "100.00",
        maximumAmount: "5000.00",
        amount: "250.00",
      })
    ).toThrowError(/only supported in ZAR/);

    expect(() =>
      assertWithdrawalPolicy({
        enabled: true,
        ownerType: "STORE",
        currency: "ZAR",
        minimumAmount: "500.00",
        maximumAmount: "5000.00",
        amount: "250.00",
      })
    ).toThrowError(/below/);
  });
});
