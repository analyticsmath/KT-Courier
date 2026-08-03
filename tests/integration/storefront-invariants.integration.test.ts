import { describe, expect, it } from "vitest";
import { assertStorefrontPublicExposureAllowed, StorefrontProductionLockedError } from "@/lib/storefront/storefront-production-lock";

describe("storefront invariants integration", () => {
  it("enforces fail-closed public exposure invariant", () => {
    expect(() => assertStorefrontPublicExposureAllowed()).toThrow(StorefrontProductionLockedError);
  });
});
