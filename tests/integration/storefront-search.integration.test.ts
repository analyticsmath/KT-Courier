import { describe, expect, it } from "vitest";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { createStorefrontFixture } from "./storefront-fixtures";

describe("canonical PostgreSQL storefront search", () => {
  it("discovers published evidence and applies exact store, price and availability filters", async () => {
    const f = await createStorefrontFixture();
    await f.projections.buildPublishedSnapshot(f.snapshot.publicReference);
    const search = new StorefrontSearchService(new PostgresStorefrontSearchAdapter());
    const result = await search.search({ store: f.store.slug, minPrice: "100.00", maxPrice: "100.00", availability: ["IN_STOCK"] });
    expect(result.resultCount).toBe(1);
    expect(JSON.stringify(result.results)).toContain(f.source.product.publicReference);
    expect((await search.search({ store: f.store.slug, maxPrice: "99.99" })).resultCount).toBe(0);
    expect((await search.search({ store: f.store.slug, availability: ["OUT_OF_STOCK"] })).resultCount).toBe(0);
    expect((await search.search({ store: "' OR 1=1 --" })).resultCount).toBe(0);
  });
});
