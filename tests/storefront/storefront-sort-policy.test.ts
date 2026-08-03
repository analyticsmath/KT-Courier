import { expect, test } from "vitest";
import { InMemoryStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { document } from "@/tests/storefront/storefront-test-helpers";
test("price sorting is deterministic without sponsored inputs", async () => { const response = await new StorefrontSearchService(new InMemoryStorefrontSearchAdapter([document({ publicReference: "SFD-B", price: { ...document().price, amount: "20.00" } }), document({ publicReference: "SFD-A", price: { ...document().price, amount: "10.00" } })])).search({ sort: "PRICE_ASC" }); expect(response.results[0]?.price.amount).toBe("10.00"); });
