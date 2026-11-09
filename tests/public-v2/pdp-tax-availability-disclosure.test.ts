import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const path = join(process.cwd(), "components/public-v2/commerce/ProductDetailExperience.tsx");
const source = readFileSync(path, "utf8");

describe("product purchase-price and stock disclosure", () => {
  it("does not advertise marketplace VAT as included when VAT may be disabled by the owner", () => {
    expect(source).not.toContain("VAT included");
    expect(source).not.toContain("VAT excluded");
    expect(source).toContain("Delivery fee confirmed at checkout");
    expect(source).toContain("Delivery fee at checkout");
  });

  it("keeps unconfirmed stock unavailable until merchant confirmation", () => {
    expect(source).toContain('activeOffer.availability === "IN_STOCK" || activeOffer.availability === "LOW_STOCK"');
    expect(source).toContain("disabled={!isPurchasable || addingToCart || buyingNow}");
    expect(source).toContain("data-kt-availability-blocker");
    expect(source).toContain("availabilityLabel(activeOffer.availability)");
  });
});
