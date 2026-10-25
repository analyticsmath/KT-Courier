import { describe, expect, it } from "vitest";
import { parseVolumePriceTiers, priceForOrderQuantity, validatePackUnit } from "@/lib/catalog/volume-pricing";

describe("server authoritative volume/pack prices", () => {
  it("chooses the highest qualifying quantity tier and preserves exact cents", () => {
    const tiers=parseVolumePriceTiers("100.00", [{minQuantity:3,unitPrice:"90.00"},{minQuantity:10,unitPrice:"75.50"}]);
    expect(priceForOrderQuantity("100.00", tiers, 1)).toBe("100.00");
    expect(priceForOrderQuantity("100.00", tiers, 3)).toBe("90.00");
    expect(priceForOrderQuantity("100.00", tiers, 11)).toBe("75.50");
  });
  it("rejects malformed, overlapping or non-discount prices", () => {
    expect(() => parseVolumePriceTiers("100.00", [{minQuantity:3,unitPrice:"105.00"}])).toThrow();
    expect(() => parseVolumePriceTiers("100.00", [{minQuantity:3,unitPrice:"90.00"},{minQuantity:3,unitPrice:"80.00"}])).toThrow();
    expect(() => parseVolumePriceTiers("100.00", [{minQuantity:0,unitPrice:"50.00"}])).toThrow();
  });
  it("pair and bulk SKU quantities describe a sellable package without reusing loose-piece stock", () => {
    expect(validatePackUnit("PAIR","2","piece")).toMatchObject({packagedQuantity:"2"});
    expect(validatePackUnit("PACK","6","piece")).toMatchObject({packagedQuantity:"6"});
    expect(() => validatePackUnit("PAIR","3","piece")).toThrow();
    expect(() => validatePackUnit("BULK","1","piece")).toThrow();
  });
});
