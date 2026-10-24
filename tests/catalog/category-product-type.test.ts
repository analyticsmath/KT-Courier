import { describe, expect, it } from "vitest";
import { categoryProductType } from "@/lib/catalog/category-selection";
const types = [{ id: "old", code: "grocery", versionNumber: 1 }, { id: "current", code: "grocery", versionNumber: 2 }, { id: "car", code: "automotive", versionNumber: 1 }];
const categories = [{ id: "root", name: "Groceries", path: "/groceries", parentId: null, productTypeIds: ["old", "current"] }, { id: "child", name: "Produce", path: "/groceries/produce", parentId: "root" }, { id: "car", name: "Car", path: "/car", parentId: null, productTypeIds: ["car"] }];
describe("category-driven product form", () => {
  it("inherits the latest available revision without an independent vendor type selection", () => { expect(categoryProductType(categories, "child", types)?.id).toBe("current"); expect(categoryProductType(categories, "car", types)?.id).toBe("car"); });
  it("fails closed for missing, ambiguous and broken mappings", () => { expect(categoryProductType(categories, "missing", types)).toBeUndefined(); expect(categoryProductType([{ ...categories[0], productTypeIds: ["car", "current"] }], "root", types)).toBeUndefined(); expect(categoryProductType([{ ...categories[1], parentId: "missing" }], "child", types)).toBeUndefined(); });
});
