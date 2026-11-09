import { describe, expect, it } from "vitest";
import { AdminWalletGrantError, validateAdminWalletGrant } from "@/lib/services/admin-customer-wallet-grant-policy";

const valid = { amount: "50.00", reason: "Manual welcome courtesy grant approved by owner", operationId: "credit-test-0001" };

describe("owner-funded nonwithdrawable customer wallet grants", () => {
  it("accepts exact ZAR cents and preserves a meaningful audit reason", () => {
    expect(validateAdminWalletGrant(valid)).toEqual(valid);
    expect(validateAdminWalletGrant({ ...valid, amount: "0.01" }).amount).toBe("0.01");
    expect(validateAdminWalletGrant({ ...valid, amount: "50" }).amount).toBe("50.00");
    expect(validateAdminWalletGrant({ ...valid, amount: "5.1" }).amount).toBe("5.10");
    expect(validateAdminWalletGrant({ ...valid, amount: "5000.00" }).amount).toBe("5000.00");
  });
  it.each(["0.00", "0", "-1.00", "05.00", "5.001", "5000.01", "999999.99", "NaN", "1e4"])(
    "refuses malformed or unauthorized credit amounts: %s", amount => {
      expect(() => validateAdminWalletGrant({ ...valid, amount })).toThrow(AdminWalletGrantError);
    },
  );
  it("requires a meaningful note, stable idempotency ID and no unexpected fields", () => {
    for (const changes of [
      { reason: "Free" }, { reason: "" }, { reason: "A".repeat(221) }, { operationId: "abc" },
      { operationId: "!" }, { currency: "USD" }, { customerUserId: "other-customer" },
    ]) {
      expect(() => validateAdminWalletGrant({ ...valid, ...changes })).toThrow(AdminWalletGrantError);
    }
    expect(() => validateAdminWalletGrant([])).toThrow(AdminWalletGrantError);
    expect(() => validateAdminWalletGrant(null)).toThrow(AdminWalletGrantError);
  });
});
