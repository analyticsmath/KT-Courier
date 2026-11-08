import { describe, expect, it } from "vitest";
import { SystemSettingType } from "@/types/db";
import { validateSettingValue } from "@/lib/validation/admin-settings";
import { SYSTEM_SETTING_CATALOG } from "@/lib/settings/catalog";
import {
  centsToZar, DEFAULT_CUSTOMER_REWARD_POLICY, earnedCustomerPoints,
  firstStoreWelcomeDiscount, loyaltyWalletConversion,
  ordinaryReferralReward, validateCustomerRewardPolicy, zarToCents,
} from "@/lib/rewards/customer-reward-policy";

describe("owner-controlled Phase 3 customer incentives", () => {
  const defaults = DEFAULT_CUSTOMER_REWARD_POLICY;

  it("retains the client's initial values and administrative boundaries", () => {
    expect(defaults).toMatchObject({
      pointsPerZar: 1, conversionPoints: 100, conversionWalletZar: "2.00",
      referralRewardZar: "5.00", firstStoreDiscountZar: "50.00", firstStoreValidDays: 7,
    });
    expect(validateCustomerRewardPolicy(defaults)).toEqual(defaults);
    for (const key of [
      "loyalty.points_per_zar", "loyalty.conversion_points", "loyalty.conversion_wallet_zar",
      "referral.reward_zar", "welcome.store.discount_zar", "welcome.store.valid_days",
      "welcome.store.minimum_order_zar",
    ]) {
      expect(SYSTEM_SETTING_CATALOG[key]?.type).toBe(SystemSettingType.NUMBER);
      expect(SYSTEM_SETTING_CATALOG[key]?.requiredPermission).toBe("settings.update");
    }
  });

  it("refuses malformed commercial policy updates and partially parsed numbers", () => {
    for (const raw of ["50junk", "1e309", "", "-1", "NaN", "Infinity", "1e3", "01"]) {
      expect(validateSettingValue(SystemSettingType.NUMBER, raw, "welcome.store.discount_zar").ok).toBe(false);
    }
    for (const raw of [Infinity, NaN, -1, 1.2, "2.01"]) {
      expect(validateSettingValue(SystemSettingType.NUMBER, raw, "welcome.store.valid_days").ok).toBe(false);
    }
    expect(validateSettingValue(SystemSettingType.NUMBER, "50.25", "welcome.store.discount_zar")).toEqual({ ok: true, value: 50.25 });
    expect(validateSettingValue(SystemSettingType.NUMBER, "2.55", "loyalty.conversion_wallet_zar")).toEqual({ ok: true, value: 2.55 });
    expect(validateSettingValue(SystemSettingType.NUMBER, "0.001", "welcome.store.discount_zar").ok).toBe(false);
    expect(validateSettingValue(SystemSettingType.NUMBER, "365", "welcome.store.valid_days")).toEqual({ ok: true, value: 365 });
    expect(validateSettingValue(SystemSettingType.NUMBER, 366, "welcome.store.valid_days").ok).toBe(false);
  });

  it("uses strict integer ZAR cents for every reward instead of floating-point money", () => {
    expect(zarToCents("123.45")).toBe(12345n);
    expect(centsToZar(100000000n)).toBe("1000000.00");
    for (const value of ["1", "1.2", "01.00", "-1.00", "1e2", "NaN", "1.001"]) {
      expect(() => zarToCents(value)).toThrow();
    }
    expect(() => centsToZar(-1n)).toThrow();
  });

  it("awards only whole-rand points from completed verified external paid value, excluding VAT/refunds/wallet", () => {
    const evidence = {
      providerPaidZar: "102.99", vatZar: "2.00", refundedProviderZar: "0.00",
      paymentVerified: true, orderCompleted: true, pointsPerZar: 1,
    };
    expect(earnedCustomerPoints(evidence)).toBe(100n);
    expect(earnedCustomerPoints({ ...evidence, paymentVerified: false })).toBe(0n);
    expect(earnedCustomerPoints({ ...evidence, orderCompleted: false })).toBe(0n);
    expect(earnedCustomerPoints({ ...evidence, refundedProviderZar: "50.01" })).toBe(50n);
    expect(earnedCustomerPoints({ ...evidence, providerPaidZar: "0.00", vatZar: "0.00" })).toBe(0n);
    expect(earnedCustomerPoints({ ...evidence, pointsPerZar: 2 })).toBe(200n);
    expect(() => earnedCustomerPoints({ ...evidence, refundedProviderZar: "102.00" })).toThrow();
    expect(() => earnedCustomerPoints({ ...evidence, vatZar: "103.00" })).toThrow();
  });

  it("redeems only exact point blocks, never more than available, with wallet balance remaining nonwithdrawable", () => {
    expect(loyaltyWalletConversion({
      availablePoints: 275n, requestedPoints: 200n, conversionPoints: 100, conversionWalletZar: "2.00",
    })).toEqual({ pointsRedeemed: 200n, walletCreditZar: "4.00", remainingPoints: 75n });
    for (const requestedPoints of [0n, -1n, 75n, 300n]) {
      expect(() => loyaltyWalletConversion({
        availablePoints: 275n, requestedPoints, conversionPoints: 100, conversionWalletZar: "2.00",
      })).toThrow();
    }
  });

  it("restricts the R50 first-purchase offer to one store purchase within exactly seven days", () => {
    const signup = new Date("2026-11-01T00:00:00.000Z");
    const accepted = {
      orderType: "MARKETPLACE" as const, customerSignupAt: signup,
      checkedAt: new Date("2026-11-07T23:59:59.999Z"),
      successfulStoreOrdersBefore: 0, priorWelcomeOfferRedemptions: 0,
      merchandiseSubtotalZar: "100.00",
      policy: {
        firstStoreDiscountZar: "50.00", firstStoreValidDays: 7,
        firstStoreMinimumZar: "75.00",
      },
    };
    expect(firstStoreWelcomeDiscount(accepted)).toBe("50.00");
    expect(firstStoreWelcomeDiscount({ ...accepted, merchandiseSubtotalZar: "75.00" })).toBe("50.00");
    expect(firstStoreWelcomeDiscount({ ...accepted, merchandiseSubtotalZar: "74.99" })).toBeNull();
    expect(firstStoreWelcomeDiscount({ ...accepted, checkedAt: new Date("2026-11-08T00:00:00.000Z") })).toBeNull();
    expect(firstStoreWelcomeDiscount({ ...accepted, orderType: "PARCEL" })).toBeNull();
    expect(firstStoreWelcomeDiscount({ ...accepted, successfulStoreOrdersBefore: 1 })).toBeNull();
    expect(firstStoreWelcomeDiscount({ ...accepted, priorWelcomeOfferRedemptions: 1 })).toBeNull();
    expect(firstStoreWelcomeDiscount({ ...accepted, merchandiseSubtotalZar: "0.00" })).toBeNull();
    expect(firstStoreWelcomeDiscount({
      ...accepted, merchandiseSubtotalZar: "25.00",
      policy: { ...accepted.policy, firstStoreMinimumZar: "0.00" },
    })).toBe("25.00");
  });

  it("qualifies only the first successful paid ordinary referral and blocks self/duplicate/promoter", () => {
    const eligible = {
      referrerOwnerType: "CUSTOMER" as const,
      referrerUserId: "owner-1", referredUserId: "new-user-2",
      verifiedFirstPaidOrder: true, qualifyingPaidOrderCount: 1,
      previouslyRewardedReferredUser: false, rewardZar: "5.00",
    };
    expect(ordinaryReferralReward(eligible)).toBe("5.00");
    expect(ordinaryReferralReward({ ...eligible, referrerOwnerType: "STORE" })).toBe("5.00");
    expect(ordinaryReferralReward({ ...eligible, referrerOwnerType: "PROMOTER" })).toBeNull();
    expect(ordinaryReferralReward({ ...eligible, referrerUserId: "new-user-2" })).toBeNull();
    expect(ordinaryReferralReward({ ...eligible, verifiedFirstPaidOrder: false })).toBeNull();
    expect(ordinaryReferralReward({ ...eligible, qualifyingPaidOrderCount: 2 })).toBeNull();
    expect(ordinaryReferralReward({ ...eligible, previouslyRewardedReferredUser: true })).toBeNull();
  });
});
