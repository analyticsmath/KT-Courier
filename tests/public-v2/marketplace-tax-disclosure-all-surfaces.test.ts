import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("marketplace displays no unconditional VAT-included label while VAT is configurable", () => {
  it.each([
    "components/public-v2/commerce/ProductDetailExperience.tsx",
    "components/public-v2/marketplace/MarketplaceCards.tsx",
    "components/storefront/StorefrontUi.tsx",
  ])("uses neutral checkout disclosures in %s", path => {
    expect(source(path)).not.toMatch(/VAT\s+(?:included|excluded)/i);
    expect(source(path)).toMatch(/(?:Final charges at checkout|Delivery fee (?:confirmed )?at checkout)/);
  });
});
