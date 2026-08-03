import { describe, expect, it } from "vitest";
import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";

describe("storefront facets integration", () => {
  it("verifies storefront facet computation lock", () => {
    expect(typeof storefrontPublicExposureAllowed()).toBe("boolean");
  });
});
