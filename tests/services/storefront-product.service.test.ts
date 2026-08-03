import { expect, test } from "vitest";
import { InMemoryStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { document } from "@/tests/storefront/storefront-test-helpers";
test("product results group public offers while keeping private store evidence isolated", async () => { const result = await new StorefrontSearchService(new InMemoryStorefrontSearchAdapter([document(), document({ publicReference: "SFD-private", productScope: "STORE_PRIVATE", storeReference: "other", storeSlug: "other" })])).search({ q: "rooibos" }); expect(result.results).toHaveLength(2); expect(result.results.every((item) => !Object.hasOwn(item, "stock"))).toBe(true); });
