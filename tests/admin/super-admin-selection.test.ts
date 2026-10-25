import { describe, expect, it } from "vitest";
import { parseCommerceSelection } from "@/lib/super-admin/selection";

describe("Super Admin form preflight", () => {
  it("rejects missing variants with a safe validation response", () => {
    expect(() => parseCommerceSelection("", ["productId", "variantId"]))
      .toThrowError(expect.objectContaining({ name: "CommerceSelectionError" }));
  });
  it("rejects a malformed selection without a runtime SyntaxError", () => {
    expect(() => parseCommerceSelection("{", ["offerPublicReference"]))
      .toThrowError(expect.objectContaining({ name: "CommerceSelectionError" }));
  });
  it("rejects wrong shape or arbitrary unknown selection", () => {
    expect(() => parseCommerceSelection(JSON.stringify({ offerPublicReference: 1 }), ["offerPublicReference"]))
      .toThrowError(expect.objectContaining({ name: "CommerceSelectionError" }));
  });
  it("reads an actual selected offer", () => {
    expect(parseCommerceSelection(JSON.stringify({offerPublicReference:"COF-123",offerVersion:2}), ["offerPublicReference","offerVersion"]))
      .toEqual({offerPublicReference:"COF-123",offerVersion:2});
  });
});
