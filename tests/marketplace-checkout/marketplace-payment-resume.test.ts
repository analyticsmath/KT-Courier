import { describe, expect, it } from "vitest";
import { restoreMarketplacePaymentRedirect } from "@/lib/marketplace-checkout/marketplace-payment-resume";

describe("marketplace checkout paid-session resume", () => {
  const valid = { status: "REQUIRES_ACTION", checkoutActionType: "REDIRECT_GET", redirectUrl: "https://checkout.paystack.com/authorized-token", expiresAt: null };
  it("returns the original approved Paystack checkout action without charging again", () => {
    expect(restoreMarketplacePaymentRedirect(valid)).toEqual({ type: "REDIRECT_GET", endpoint: valid.redirectUrl });
  });
  it("never returns a checkout action for unknown or already-settled payment attempts", () => {
    for (const status of ["UNKNOWN", "SUCCEEDED", "FAILED", "PROCESSING", "CANCELLED", "REQUESTING"]) {
      expect(restoreMarketplacePaymentRedirect({ ...valid, status })).toBeNull();
    }
  });
  it("rejects expired actions and disallowed redirect hosts even if persisted", () => {
    expect(restoreMarketplacePaymentRedirect({ ...valid, expiresAt: new Date(0) })).toBeNull();
    expect(restoreMarketplacePaymentRedirect({ ...valid, redirectUrl: "https://paystack.com.attacker.invalid/pay" })).toBeNull();
    expect(restoreMarketplacePaymentRedirect({ ...valid, redirectUrl: "http://checkout.paystack.com/pay" })).toBeNull();
  });
});
