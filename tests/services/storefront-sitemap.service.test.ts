import { expect, test } from "vitest";
import { source } from "@/tests/storefront/storefront-test-helpers";
test("sitemap service only reads current canonical adapter documents behind the source lock", () => { const sitemap = source("app/(public)/shop/sitemap.ts"); expect(sitemap).toContain("PostgresStorefrontSearchAdapter"); expect(sitemap).toContain("document.indexable"); expect(sitemap).toContain("storefrontPublicExposureAllowed"); });
