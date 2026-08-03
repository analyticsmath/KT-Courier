import { describe, expect, it } from "vitest";
import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";

describe("storefront projection integration", () => {
  it("validates projection lock status", () => {
    expect(storefrontPublicExposureAllowed()).toBe(false);
  });
});
