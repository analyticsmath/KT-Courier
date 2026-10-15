import { describe, expect, it, vi } from "vitest";
import { CatalogListingDraftSchema } from "@/lib/validation/catalog-listing-draft";

const db = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
import { createStoreCatalogListingDraft } from "@/lib/services/catalog-listing-draft.service";

const price = { amount: "20.00", currency: "ZAR", priceIncludesTax: true, effectiveFrom: "2026-10-14T00:00:00.000Z" };
const common = {
  operationId: "variant-listing-operation", product: { scope: "STORE_PRIVATE", productTypeDefinitionId: "ctype000000000000000001", primaryCategoryId: "ccategory000000000000001", title: "Cotton shirt", description: "A plain cotton shirt with selectable colours.", condition: "NEW", attributeValues: {}, complianceValues: {} },
  inventoryLocationPublicReference: "IL-00000000000000000000000000000000", modifiers: [],
  media: [{ assetPublicReference: "CMA-00000000000000000000000000000000", altText: "Cotton shirt", displayOrder: 0, primary: true, variantAssociation: "PRODUCT" }],
};
const variant = (colour: string) => ({ title: colour, options: [{ code: "colour", value: colour }], attributeValues: {}, storeSku: `shirt-${colour}`, price, openingStock: colour === "Blue" ? 3 : 8 });

describe("explicit sellable variant listing contract", () => {
  it("accepts independently priced/stocked variants without a fictitious default offer", () => {
    expect(CatalogListingDraftSchema.safeParse({ ...common, variants: [variant("Blue"), variant("Red")] }).success).toBe(true);
  });
  it("preserves the existing single-default-variant request", () => {
    expect(CatalogListingDraftSchema.safeParse({ ...common, variants: [], storeSku: "shirt", price, openingStock: 5 }).success).toBe(true);
  });
  it.each(["storeSku", "price", "openingStock"])("rejects a missing per-variant %s before entering a transaction", async key => {
    const incomplete: Record<string, unknown> = variant("Blue"); delete incomplete[key];
    const raw = { ...common, variants: [incomplete], storeSku: "unused-default", price, openingStock: 50 };
    expect(CatalogListingDraftSchema.safeParse(raw).success).toBe(false);
    await expect(createStoreCatalogListingDraft("store", "owner", raw as never)).rejects.toMatchObject({ code: "LISTING_DRAFT_INVALID" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("rejects normalized duplicate options/SKUs, inconsistent option dimensions and missing stock locations", () => {
    const invalid = [
      { ...common, variants: [variant("Blue"), { ...variant("blue"), storeSku: "different" }] },
      { ...common, variants: [variant("Blue"), { ...variant("Red"), storeSku: "SHIRT-blue" }] },
      { ...common, variants: [variant("Blue"), { ...variant("Red"), options: [{ code: "size", value: "Large" }] }] },
      { ...common, inventoryLocationPublicReference: undefined, variants: [variant("Blue")] },
      { ...common, variants: [{ ...variant("Blue"), options: [{ code: "colour", value: "Blue" }, { code: "colour", value: "Red" }] }] },
    ];
    for (const raw of invalid) expect(CatalogListingDraftSchema.safeParse(raw).success).toBe(false);
  });
});
