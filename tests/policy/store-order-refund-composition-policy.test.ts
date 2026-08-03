import { describe, expect, it } from "vitest";
import { assertMarketplaceRefundRequestMethod } from "@/lib/services/refund-request.service";

describe("store-order marketplace refund policy", () => {
  it("permits an authenticated original-method refund", () => {
    expect(assertMarketplaceRefundRequestMethod({ customerUserId: "user_1", method: "ORIGINAL_PAYMENT_METHOD" })).toBe("AUTHENTICATED");
  });

  it("requires an explicit authenticated wallet election", () => {
    expect(() => assertMarketplaceRefundRequestMethod({ customerUserId: "user_1", method: "CUSTOMER_WALLET" })).toThrow("explicit authenticated customer election");
    expect(assertMarketplaceRefundRequestMethod({ customerUserId: "user_1", method: "CUSTOMER_WALLET", customerWalletElected: true })).toBe("AUTHENTICATED");
  });

  it("allows a verified guest only on the original method", () => {
    expect(assertMarketplaceRefundRequestMethod({ guestConfirmationVerified: true, method: "ORIGINAL_PAYMENT_METHOD" })).toBe("GUEST_ORIGINAL_METHOD");
  });

  it("rejects an unverified guest and a guest wallet election", () => {
    expect(() => assertMarketplaceRefundRequestMethod({ guestConfirmationVerified: false, method: "ORIGINAL_PAYMENT_METHOD" })).toThrow("verified guest authority");
    expect(() => assertMarketplaceRefundRequestMethod({ guestConfirmationVerified: true, method: "CUSTOMER_WALLET" })).toThrow("original payment method");
  });
});
