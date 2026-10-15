import { describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ find: vi.fn(), variant: vi.fn(), option: vi.fn(), value: vi.fn(), link: vi.fn(), evidence: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { catalogProduct: { findUnique: f.find } } }));
vi.mock("@/lib/services/catalog-service-support", () => ({ withCatalogTransaction: async (_tx: unknown, run: (tx: unknown) => unknown) => run({ catalogProductVariant: { create: f.variant }, catalogProductOption: { upsert: f.option }, catalogProductOptionValue: { upsert: f.value }, catalogVariantOptionValue: { create: f.link } }), recordCatalogEvidence: f.evidence }));
import { createCatalogVariant } from "@/lib/services/catalog-variant.service";

describe("canonical variant option persistence", () => {
  it("writes queryable option/value links with normalized identity and preserved labels", async () => {
    f.find.mockResolvedValue({ id: "product", publicReference: "CP-1", sourceStoreId: "store", status: "DRAFT" });
    f.variant.mockResolvedValue({ id: "variant", publicReference: "CV-1" });
    f.option.mockResolvedValueOnce({ id: "colour" }).mockResolvedValueOnce({ id: "size" });
    f.value.mockResolvedValueOnce({ id: "blue" }).mockResolvedValueOnce({ id: "large" });
    await createCatalogVariant({ storeId: "store", actorUserId: "owner", productPublicReference: "CP-1", title: "Blue large", options: [{ code: "colour", value: " Blue " }, { code: "size", value: "Large" }], attributeValues: {} });
    expect(f.option.mock.calls.map(call => call[0].create.code)).toEqual(["colour", "size"]);
    expect(f.value.mock.calls.map(call => call[0].create)).toEqual([
      { optionId: "colour", code: "blue", label: "Blue", normalizedValue: "blue" },
      { optionId: "size", code: "large", label: "Large", normalizedValue: "large" },
    ]);
    expect(f.link.mock.calls.map(call => call[0].data)).toEqual([{ variantId: "variant", optionValueId: "blue" }, { variantId: "variant", optionValueId: "large" }]);
    expect(f.evidence).toHaveBeenCalledOnce();
  });
});
