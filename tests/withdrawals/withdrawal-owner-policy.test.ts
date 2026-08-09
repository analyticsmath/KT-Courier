import { describe, expect, it } from "vitest";
import {
  isWithdrawalOwnerType,
  assertWithdrawalOwnerEligibility,
  WITHDRAWAL_OWNER_TYPES,
} from "@/lib/withdrawals/withdrawal-owner-policy";

describe("withdrawal owner policy", () => {
  it("covers store, driver, promoter eligibility and customer denial", () => {
    expect(WITHDRAWAL_OWNER_TYPES).toEqual(["STORE", "DRIVER", "PROMOTER"]);

    expect(isWithdrawalOwnerType("STORE")).toBe(true);
    expect(isWithdrawalOwnerType("DRIVER")).toBe(true);
    expect(isWithdrawalOwnerType("PROMOTER")).toBe(true);
    expect(isWithdrawalOwnerType("CUSTOMER")).toBe(false);
    expect(isWithdrawalOwnerType("ADMIN")).toBe(false);

    expect(() =>
      assertWithdrawalOwnerEligibility({
        ownerType: "STORE",
        ownerId: "store-1",
        userId: "user-1",
        active: true,
        suspended: false,
      })
    ).not.toThrow();

    expect(() =>
      assertWithdrawalOwnerEligibility({
        ownerType: "DRIVER",
        ownerId: "driver-1",
        userId: "user-2",
        active: false,
        suspended: false,
      })
    ).toThrowError(/not eligible/);

    expect(() =>
      assertWithdrawalOwnerEligibility({
        ownerType: "PROMOTER",
        ownerId: "promoter-1",
        userId: "user-3",
        active: true,
        suspended: true,
      })
    ).toThrowError(/not eligible/);
  });
});
