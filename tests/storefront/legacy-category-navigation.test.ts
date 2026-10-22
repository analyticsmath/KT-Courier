import { describe, expect, it } from "vitest";
import { selectFeaturedMarketplaceCategories } from "@/lib/public-marketplace/featured-categories";
import { buildCinematicCategoryNavigation } from "@/lib/public-marketplace/category-navigation-model";

describe("real legacy category navigation", () => {
  const categories = [
    { reference: "LEG6-CAT-290", path: "/home-living-290", name: "Home & Living", productCount: 7, children: [{ reference: "LEG6-CAT-318", path: "/home-living-290/furniture-318", name: "Furniture" }] },
    { reference: "LEG6-CAT-318", path: "/home-living-290/furniture-318", name: "Furniture", productCount: 7 },
    { reference: "LEG6-CAT-388", path: "/shipping-boxes-388", name: "Shipping Boxes", productCount: 35 },
    { reference: "LEG6-CAT-999", path: "/empty-root-999", name: "Empty", productCount: 0 },
  ];
  it("uses populated real roots when the five old authored paths do not exist", () => {
    expect(selectFeaturedMarketplaceCategories(categories).map(category => category.reference)).toEqual(["LEG6-CAT-388", "LEG6-CAT-290"]);
  });
  it("preserves real child paths, names and published counts", () => {
    const result = buildCinematicCategoryNavigation(categories);
    expect(result.find(category => category.reference === "LEG6-CAT-290")?.children).toEqual([{ reference: "LEG6-CAT-318", path: "/home-living-290/furniture-318", name: "Furniture", productCount: 7 }]);
  });
  it("retains authored paths when the canonical taxonomy actually contains them", () => {
    const authored = { reference: "CURRENT-GROCERIES", path: "/groceries", name: "Groceries", productCount: 2 };
    expect(selectFeaturedMarketplaceCategories([...categories, authored])).toEqual([authored]);
  });
});
