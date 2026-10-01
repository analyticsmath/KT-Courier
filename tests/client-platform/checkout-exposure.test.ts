import { describe, it, expect } from "vitest";
import { isCheckoutExposureAllowed } from "@/lib/runtime/deployment-classification";
import { evaluateMarketplaceCheckoutPublicGate } from "@/lib/marketplace-checkout/production-lock";
describe("checkout exposure controls", () => {
  const production = {
    NODE_ENV: "production",
    KT_DATABASE_CLASSIFICATION: "production",
  };
  it("requires explicit checkout opt-in even when the code is approved", () => {
    expect(isCheckoutExposureAllowed(production, true)).toBe(false);
    expect(
      isCheckoutExposureAllowed(
        { ...production, CHECKOUT_PUBLIC_ENABLED: "false" },
        true,
      ),
    ).toBe(false);
    expect(
      isCheckoutExposureAllowed(
        { ...production, CHECKOUT_PUBLIC_ENABLED: "true" },
        true,
      ),
    ).toBe(true);
  });
  it("cannot use code approval to downgrade a production database to staging", () => {
    expect(
      isCheckoutExposureAllowed(
        {
          ...production,
          KT_RUNTIME_ENV: "staging-demo",
          KT_STAGING_DEMO_ENABLED: "true",
          CHECKOUT_PUBLIC_ENABLED: "true",
        },
        true,
      ),
    ).toBe(false);
  });
  it("cannot enable production checkout without source approval", () => {
    expect(
      isCheckoutExposureAllowed(
        { ...production, CHECKOUT_PUBLIC_ENABLED: "true" },
        false,
      ),
    ).toBe(false);
  });
  it("reports the disabled public switch before provider setup and denies payment", () => {
    expect(
      evaluateMarketplaceCheckoutPublicGate({
        ...production,
        CHECKOUT_PUBLIC_ENABLED: "false",
      }),
    ).toEqual({ enabled: false, blockReason: "CHECKOUT_PUBLIC_DISABLED" });
  });
});
