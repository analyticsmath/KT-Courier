import { describe, expect, it } from "vitest";
import { hashPricingInput } from "@/lib/pricing/input-hash";

describe("pricing input hashing", () => {
  it("is stable across object key order and changes when semantic inputs change", () => {
    expect(hashPricingInput({ b: 2, a: { y: 2, x: 1 } })).toBe(hashPricingInput({ a: { x: 1, y: 2 }, b: 2 }));
    expect(hashPricingInput({ latitude: 1 })).not.toBe(hashPricingInput({ latitude: 2 }));
  });
});
