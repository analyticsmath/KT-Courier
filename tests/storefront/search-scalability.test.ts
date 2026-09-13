import { describe, expect, it } from "vitest";
import {
  InMemoryStorefrontSearchAdapter,
} from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import type { StorefrontDocument } from "@/lib/storefront/storefront-types";

function createMockDocument(index: number, overrides: Partial<StorefrontDocument> = {}): StorefrontDocument {
  const price = (10 + index * 5).toFixed(2);
  return {
    publicReference: `doc-${index}`,
    publicationVersion: "v1",
    productReference: `prod-${index % 50}`,
    productSlug: `product-${index % 50}`,
    productScope: "GLOBAL_CANONICAL",
    variantReference: `var-${index}`,
    offerReference: `offer-${index}`,
    storeReference: `store-${index % 5}`,
    storeSlug: `store-${index % 5}`,
    categoryReference: "cat-general",
    categoryPath: "/electronics",
    productTypeCode: "HARDWARE",
    productTypeVersion: 1,
    brandReference: index % 2 === 0 ? "brand-sony" : "brand-samsung",
    brandName: index % 2 === 0 ? "Sony" : "Samsung",
    title: `Electronic Device Model ${index}`,
    normalizedTitle: `electronic device model ${index}`,
    shortDescription: "A great device",
    searchText: `electronic device model ${index} hardware`,
    searchableAttributes: {},
    filterableAttributes: { color: index % 2 === 0 ? "Black" : "Silver" },
    variantOptions: {},
    condition: "NEW",
    fulfilmentMode: "COURIER_DELIVERY",
    sellingUnit: "EACH",
    price: { publicReference: `price-${index}`, amount: price, currency: "ZAR", includesTax: true },
    availability: "IN_STOCK",
    publishedAt: "2026-01-01T00:00:00.000Z",
    sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
    searchable: true,
    indexable: true,
    ...overrides,
  };
}

describe("Phase 1 Acceptance: Marketplace Search Scalability & Server-Side Filtering", () => {
  it("pushes down price range, condition, and fulfilment filters into the search adapter", async () => {
    const docs = [
      createMockDocument(1, { price: { publicReference: "p1", amount: "50.00", currency: "ZAR", includesTax: true }, condition: "NEW", fulfilmentMode: "COURIER_DELIVERY" }),
      createMockDocument(2, { price: { publicReference: "p2", amount: "150.00", currency: "ZAR", includesTax: true }, condition: "NEW", fulfilmentMode: "COURIER_DELIVERY" }),
      createMockDocument(3, { price: { publicReference: "p3", amount: "250.00", currency: "ZAR", includesTax: true }, condition: "USED", fulfilmentMode: "STORE_PICKUP" }),
      createMockDocument(4, { price: { publicReference: "p4", amount: "350.00", currency: "ZAR", includesTax: true }, condition: "NEW", fulfilmentMode: "COURIER_DELIVERY" }),
    ];

    const adapter = new InMemoryStorefrontSearchAdapter(docs);

    // Filter between 100.00 and 300.00, condition NEW, courier delivery
    const results = await adapter.search({
      minPrice: "100.00",
      maxPrice: "300.00",
      condition: ["NEW"],
      fulfilment: ["COURIER_DELIVERY"],
    });

    expect(results).toHaveLength(1);
    expect(results[0].publicReference).toBe("doc-2");
    expect(results[0].price.amount).toBe("150.00");
  });

  it("handles offset and limit pagination without in-memory 10,000 document clamping", async () => {
    // Generate 150 documents
    const docs = Array.from({ length: 150 }, (_, i) => createMockDocument(i + 1));
    const adapter = new InMemoryStorefrontSearchAdapter(docs);

    // Fetch page 2: offset 20, limit 20
    const page2 = await adapter.search({
      offset: 20,
      limit: 20,
    });

    expect(page2).toHaveLength(20);
    expect(page2[0].publicReference).toBe("doc-21");
    expect(page2[19].publicReference).toBe("doc-40");
  });

  it("StorefrontSearchService produces paginated results and accurate faceted aggregations", async () => {
    const docs = [
      createMockDocument(1, { brandName: "Sony", filterableAttributes: { color: "Black" } }),
      createMockDocument(2, { brandName: "Sony", filterableAttributes: { color: "Silver" } }),
      createMockDocument(3, { brandName: "Samsung", filterableAttributes: { color: "Black" } }),
      createMockDocument(4, { brandName: "Samsung", filterableAttributes: { color: "Black" } }),
    ];

    const adapter = new InMemoryStorefrontSearchAdapter(docs);
    const service = new StorefrontSearchService(adapter);

    const response = await service.search({
      pageSize: 2,
      page: 1,
    });

    expect(response.results).toBeDefined();
    expect(response.resultCount).toBe(4);
    expect(response.results).toHaveLength(2);
    expect(response.nextCursor).not.toBeNull();

    const facets = response.facets;
    expect(facets).toBeDefined();
    const colorFacet = facets.find((f) => f.code === "color");
    expect(colorFacet).toBeDefined();
    const blackCount = colorFacet?.values.find((v) => v.value === "Black")?.count;
    const silverCount = colorFacet?.values.find((v) => v.value === "Silver")?.count;
    expect(blackCount).toBe(3);
    expect(silverCount).toBe(1);
  });
});
