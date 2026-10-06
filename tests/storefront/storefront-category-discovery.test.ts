import { describe, expect, it } from "vitest";
import { matchesStorefrontCategory, storefrontCategoryPredicate } from "@/lib/storefront/storefront-category-discovery";
import { InMemoryStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { document } from "@/tests/storefront/storefront-test-helpers";
describe("reviewed legacy browse taxonomy", () => {
  it.each([
    ["/burger-373/meal-types-380", "Beef Burger", "food-dining/burgers"],
    ["/home-living-290/furniture-318", "Sofa", "home-living"],
    ["/household-essentials-80/cleaning-supplies-detergents-disinfectants-etc-144", "Dishwashing liquid", "groceries/household"],
    ["/fashion-apparel-288/accessories-312", "Shopping bag", "fashion/accessories"],
    ["/personal-care-422", "Body lotion", "pharmacy/personal-care"],
    ["/health-wellness-299/medical-supplies-351", "Sea Moss", "pharmacy/vitamins"],
    ["/food-dining/burgers", "New vendor burger", "food-dining"],
  ])("discovers %s under %s without rewriting it", (categoryPath, title, target) => {
    const source = { categoryPath, title };
    expect(matchesStorefrontCategory(source, target)).toBe(true);
    expect(source.categoryPath).toBe(categoryPath);
    expect(matchesStorefrontCategory(source, target.split("/")[0])).toBe(true);
  });
  it("keeps unavailable categories and misleading legacy titles out", () => {
    expect(matchesStorefrontCategory({ categoryPath: "/restaurants-7/fast-food-10", title: "Loaded Fries" }, "/food-dining/burgers")).toBe(false);
    expect(matchesStorefrontCategory({ categoryPath: "/toys-kids-baby-291/kids-clothing-accessories-326", title: "Silicone Baby Feeding Set" }, "/fashion/clothing")).toBe(false);
    expect(matchesStorefrontCategory({ categoryPath: "/kitchen-storage-countertop-organization-428/home-living-429", title: "Bread Bin" }, "/groceries/pantry")).toBe(false);
    expect(matchesStorefrontCategory({ categoryPath: "/restaurants-7", title: "Burger" }, "/food-dining/pizza")).toBe(false);
  });
  it("preserves boundary matching and parameterizes hostile paths", () => {
    expect(matchesStorefrontCategory({ categoryPath: "/food-dining-extra", title: "Burger" }, "/food-dining")).toBe(false);
    const sql = storefrontCategoryPredicate("/food-dining/%'; DROP TABLE test;--");
    expect(sql.text).not.toContain("DROP TABLE");
    expect(sql.values).toContain("/food-dining/%'; DROP TABLE test;--");
  });
  it("retains aliases through final filters, counts products once and isolates stores", async () => {
    const docs = [document({ categoryPath: "/burger-373/meal-types-380", title: "Beef Burger", productReference: "LEG6-PROD-1", storeSlug: "vendor-a" }), document({ publicReference: "SFD-2", variantReference: "V-2", categoryPath: "/burger-373/meal-types-380", title: "Beef Burger", productReference: "LEG6-PROD-1", storeSlug: "vendor-a" }), document({ publicReference: "SFD-3", categoryPath: "/wings-374/meal-types-379", title: "Wings", productReference: "LEG6-PROD-2", storeSlug: "vendor-b" })];
    const service = new StorefrontSearchService(new InMemoryStorefrontSearchAdapter(docs));
    expect((await service.search({ category: "food-dining" })).resultCount).toBe(2);
    expect((await service.search({ category: "food-dining", store: "vendor-a" })).resultCount).toBe(1);
    expect((await service.search({ category: "food-dining/burgers" })).results[0].variantCount).toBe(2);
  });
});
