// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { StoreCatalogWizard } from "@/components/catalog/StoreCatalogWizard";
import { CatalogVariantFields } from "@/components/catalog/CatalogVariantFields";

const media = { assetPublicReference: `CMA-${"A".repeat(32)}`, status: "READY", mimeType: "image/png", byteSize: 123, width: 400, height: 400, altText: "A cotton shirt", primary: true, variantAssociation: "PRODUCT" };
vi.mock("@/components/catalog/CatalogMediaUploader", () => ({ CatalogMediaUploader: ({ onChange }: { onChange: (value: unknown[]) => void }) => createElement("button", { type: "button", onClick: () => onChange([media]) }, "Attach shared product image") }));

afterEach(() => { window.localStorage.clear(); vi.unstubAllGlobals(); });

it("provides native fields for product options and independent variant commerce", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const raw = JSON.stringify([{ title: "Blue", options: [{ code: "colour", value: "Blue" }], storeSku: "BLUE", price: "19.25", openingStock: "3", attributeValues: {} }]);
  try {
    await act(async () => root.render(createElement(CatalogVariantFields, { raw, onChange: vi.fn(), mode: "options" })));
    expect([...host.querySelectorAll("label")].map(label => label.textContent)).toEqual(expect.arrayContaining(["Variant name", "Option name", "Option value"]));
    expect(host.querySelector("textarea")).toBeNull();
    await act(async () => root.render(createElement(CatalogVariantFields, { raw, onChange: vi.fn(), mode: "commerce" })));
    for (const text of ["Variant SKU", "Variant price including VAT (ZAR)", "Variant opening stock"]) {
      const label = [...host.querySelectorAll("label")].find(item => item.textContent === text)!;
      expect(label.control).toBeInstanceOf(HTMLInputElement);
    }
    expect(host.querySelector<HTMLInputElement>("#variant-0-price")?.value).toBe("19.25");
    expect(host.querySelector<HTMLInputElement>("#variant-0-stock")?.value).toBe("3");
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it("submits explicit per-variant price and stock from the real wizard and links every saved offer", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const reference = (prefix: string, char: string) => `${prefix}-${char.repeat(32)}`;
  const owner = "variants-regression";
  window.localStorage.setItem(`kt_store_catalog_wizard_draft:v2:${owner}`, JSON.stringify({
    existingSearch: "", productTypeDefinitionId: "ctype000000000000000001", primaryCategoryId: "ccategory000000000000001", title: "Cotton shirt", description: "Cotton shirt in selectable colours and sizes.", attributes: "{}", compliance: "{}", modifiers: "",
    storeSku: "", price: "", stock: "", inventoryLocation: reference("IL", "B"),
    variants: JSON.stringify([
      { title: "Blue", options: [{ code: "colour", value: "Blue" }], storeSku: "SHIRT-BLUE", price: "19.25", openingStock: "3", attributeValues: {} },
      { title: "Red", options: [{ code: "colour", value: "Red" }], storeSku: "SHIRT-RED", price: "27.50", openingStock: "8", attributeValues: {} },
    ]),
  }));
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ product: { publicReference: reference("CP", "C"), offers: [
    { publicReference: reference("CO", "D"), variant: { title: "Blue" } }, { publicReference: reference("CO", "E"), variant: { title: "Red" } },
  ] } }) });
  vi.stubGlobal("fetch", fetcher);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const click = async (text: string) => { const button = [...host.querySelectorAll("button")].find(item => item.textContent?.includes(text))!; expect(button).toBeDefined(); await act(async () => button.click()); };
  try {
    await act(async () => root.render(createElement(StoreCatalogWizard, { productTypes: [], categories: [{ id: "ccategory000000000000001", name: "Clothing", path: "/clothing", parentId: null }], draftOwnerKey: owner })));
    await click("Photos & options"); await click("Attach shared product image"); await click("Review & save"); await click("Save product draft");
    expect(fetcher).toHaveBeenCalledOnce(); expect(fetcher.mock.calls[0][0]).toBe("/api/store/catalog/listing-drafts");
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("storeSku"); expect(body).not.toHaveProperty("openingStock");
    expect(body.variants).toMatchObject([{ title: "Blue", storeSku: "SHIRT-BLUE", price: { amount: "19.25", currency: "ZAR", priceIncludesTax: true }, openingStock: 3 }, { title: "Red", storeSku: "SHIRT-RED", price: { amount: "27.50" }, openingStock: 8 }]);
    expect(host.querySelectorAll('a[href^="/store/catalog/offers/"]')).toHaveLength(2);
    expect(host.textContent).toContain("View saved offer: Blue"); expect(host.textContent).toContain("View saved offer: Red");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
