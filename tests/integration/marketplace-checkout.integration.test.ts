import { describe, expect, it } from "vitest";
import { canonicalMarketplaceFingerprint } from "@/lib/marketplace-checkout/policy";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";

describe("Phase 20 Marketplace Checkout Quote & Idempotency Integration Tests", () => {
  it("generates deterministic canonical SHA-256 fingerprints regardless of key ordering", () => {
    const objA = { amount: 150, currency: "ZAR", storeId: "store-1" };
    const objB = { storeId: "store-1", currency: "ZAR", amount: 150 };

    const fpA = canonicalMarketplaceFingerprint(objA);
    const fpB = canonicalMarketplaceFingerprint(objB);

    expect(fpA).toBe(fpB);
    expect(fpA).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces distinct fingerprints when commercial payload differs", () => {
    const obj1 = { amount: 150, currency: "ZAR" };
    const obj2 = { amount: 150.01, currency: "ZAR" };

    expect(canonicalMarketplaceFingerprint(obj1)).not.toBe(
      canonicalMarketplaceFingerprint(obj2)
    );
  });

  it("instantiates MarketplaceCheckoutError with custom code and message", () => {
    const error = new MarketplaceCheckoutError("CHECKOUT_NOT_FOUND", "The checkout session was not found.");
    expect(error.name).toBe("MarketplaceCheckoutError");
    expect(error.code).toBe("CHECKOUT_NOT_FOUND");
    expect(error.message).toBe("The checkout session was not found.");
  });
});
