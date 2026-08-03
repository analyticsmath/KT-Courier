import { expect, test } from "vitest";
import { storefrontVariantJsonLd } from "@/lib/storefront/seo/storefront-structured-data";
import { document } from "@/tests/storefront/storefront-test-helpers";
test("structured data price is the visible projection price", () => { expect(JSON.parse(storefrontVariantJsonLd(document())).offers.price).toBe("10.00"); });
