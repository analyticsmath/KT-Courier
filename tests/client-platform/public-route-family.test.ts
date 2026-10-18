import { describe, expect, it } from "vitest";
import { isProtectedCatalog } from "../../components/public-v3/redesign/route-family";

describe("protected catalog visual boundary", () => {
  it.each(["/shop", "/shop/categories", "/shop/stores/local-store", "/shop/products/parcel-book", "/shop/search"])("preserves the existing catalog shell for %s", pathname => {
    expect(isProtectedCatalog(pathname)).toBe(true);
  });
  it.each(["/", "/services/parcel", "/quote", "/cart", "/checkout/reference", "/shopping"])("does not mistake %s for a protected catalog descendant", pathname => {
    expect(isProtectedCatalog(pathname)).toBe(false);
  });
});
