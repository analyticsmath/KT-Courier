import { expect, test } from "vitest";
import { source } from "@/tests/storefront/storefront-test-helpers";

test("public marketplace landing remains browse-first and does not simulate a cart or checkout", () => {
  const page = source("app/(public)/shop/page.tsx");
  const landing = source("components/public-v2/marketplace/MarketplaceLanding.tsx");
  expect(page).toContain("MarketplaceLanding");
  expect(page).toContain("getStorefrontHome");
  expect(`${page}\n${landing}`).not.toMatch(/href="\/cart"|href="\/checkout"|\/api\/cart|addToCart/i);
});
