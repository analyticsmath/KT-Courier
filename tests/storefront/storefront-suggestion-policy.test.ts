import { expect, test } from "vitest";
import { InMemoryStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { document } from "@/tests/storefront/storefront-test-helpers";
test("suggestions are bounded public references", async () => { const response = await new StorefrontSearchService(new InMemoryStorefrontSearchAdapter([document()])).suggest("roo"); expect(response.products).toHaveLength(1); expect(JSON.stringify(response)).not.toContain("storageKey"); });
