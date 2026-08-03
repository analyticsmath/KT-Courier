import { describe, expect, it } from "vitest";
import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";

describe("storefront search integration", () => {
  it("validates search lock status", () => {
    expect(storefrontPublicExposureAllowed()).toBe(false);
  });
});
