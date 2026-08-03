import { expect, test } from "vitest";
import { InMemoryStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { document } from "@/tests/storefront/storefront-test-helpers";
test("suggestions are public, short, and derived from injected search evidence", async () => { const result = await new StorefrontSearchService(new InMemoryStorefrontSearchAdapter([document()])).suggest("ro"); expect(result.products[0]).toMatchObject({ productReference: document().productReference }); expect(JSON.stringify(result)).not.toMatch(/stock|storage|moderation/i); });
