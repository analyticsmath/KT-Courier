import { describe, expect, it } from "vitest";
import { readStorefrontLocationContext } from "@/lib/storefront/storefront-location.service";

describe("storefront location integration", () => {
  it("reads default storefront location context when unauthenticated/unset", () => {
    const ctx = readStorefrontLocationContext(undefined);
    expect(ctx.serviceAreaReference).toBeNull();
    expect(ctx.resolutionStatus).toBe("UNKNOWN");
  });
});
