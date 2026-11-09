import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { humanizeAvailability } from "@/lib/public-marketplace/commerce-presentation";

const card = readFileSync(join(process.cwd(), "components/public-v2/commerce/MarketplaceProductCard.tsx"), "utf8");

describe("public marketplace purchasing remains consistent across cards and product detail", () => {
  it.each(["IN_STOCK", "LOW_STOCK", "UNTRACKED", "CONFIRM_AT_CHECKOUT", "MADE_TO_ORDER", "OUT_OF_STOCK", "NOT_AVAILABLE_IN_AREA"] as const)(
    "uses the same customer purchase eligibility as the product detail for %s", value => {
      const eligible = value === "IN_STOCK" || value === "LOW_STOCK";
      expect(humanizeAvailability(value).isAvailable).toBe(eligible);
    },
  );
  it("does not offer quick-add from product cards for items whose stock is unconfirmed", () => {
    expect(card).toContain('product.availability === "IN_STOCK" || product.availability === "LOW_STOCK"');
    expect(card).toContain("disabled={!canQuickBuy}");
    expect(card).toContain("onClick={() => setQuickBuyOpen(true)}");
  });
});
