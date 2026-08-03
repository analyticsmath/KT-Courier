import { describe, expect, it } from "vitest";
import { assertSubstitutionPriceCap } from "@/lib/store-orders/allocation";
describe("substitution-price-cap", () => {
  it("permits an equal or lower substitute", () => expect(() => assertSubstitutionPriceCap({ substituteCharge: "9.99", originalRemainingCharge: "10.00" })).not.toThrow());
  it("blocks a higher-priced substitute", () => expect(() => assertSubstitutionPriceCap({ substituteCharge: "10.01", originalRemainingCharge: "10.00" })).toThrow("cannot cost more"));
});
