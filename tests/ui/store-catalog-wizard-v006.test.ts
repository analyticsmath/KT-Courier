// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoreCatalogWizard } from "@/components/catalog/StoreCatalogWizard";

const READY_ASSET = {
  publicReference: "CMA-V006READY0001",
  purpose: "PRODUCT_IMAGE",
  status: "READY",
  mimeType: "image/png",
  width: 600,
  height: 600,
  byteSize: 8192,
};

const CATEGORIES = [
  {
    id: "catbakery000000000000001",
    name: "Bakery",
    path: "/bakery",
    parentId: null,
    displayOrder: 1,
    productTypeCodes: ["BAKERY"],
  },
];

const PRODUCT_TYPES = [
  {
    id: "cptdef000000000000000001",
    name: "Bakery item",
    code: "BAKERY",
    versionNumber: 1,
    attributeSchema: {
      attributes: [
        { code: "flavour", label: "Flavour", type: "TEXT", required: true },
        { code: "gluten_free", label: "Gluten free", type: "BOOLEAN", required: false },
      ],
    },
    complianceSchema: {
      requirements: [
        { code: "allergens", label: "Allergen disclosure", required: true },
      ],
    },
  },
];

function setControlValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("StoreCatalogWizard V-006 structured inputs, earliest error jump, and truthful VAT", () => {
  let host: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/store/catalog/media")) {
        return new Response(JSON.stringify({ assets: [READY_ASSET] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/api/store/catalog/listing-drafts")) {
        return new Response(
          JSON.stringify({
            product: {
              publicReference: "CP-V006-SAVED-1",
              offers: [{ publicReference: "CO-V006-SAVED-1", storeSku: "BAKE-01" }],
            },
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  async function renderWizard(vatContext?: { defaultPriceIncludesTax: boolean; vatNote?: string }) {
    await act(async () => {
      root.render(
        createElement(StoreCatalogWizard, {
          draftOwnerKey: "owner-1:store-1",
          productTypes: PRODUCT_TYPES,
          categories: CATEGORIES,
          inventoryLocations: [{ publicReference: "LOC-JHB-1", name: "Sandton Bakery" }],
          packageLimits: [
            {
              displayName: "Small",
              lengthCm: 40,
              widthCm: 30,
              heightCm: 20,
              maximumWeightKg: 5,
            },
          ],
          vatContext,
        }),
      );
    });
  }

  async function goToStep(stepLabel: string) {
    const button = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes(stepLabel),
    )!;
    await act(async () => button.click());
  }

  it("jumps to the earliest invalid step for missing required attributes, compliance, and non-positive ZAR price", async () => {
    await renderWizard({ defaultPriceIncludesTax: false, vatNote: "No VAT charged" });

    // Select category + enter title on Step 0, leaving required attribute empty
    const categorySelect = host.querySelector<HTMLSelectElement>("select")!;
    await act(async () => setControlValue(categorySelect, "catbakery000000000000001"));
    await act(async () =>
      setControlValue(host.querySelector<HTMLInputElement>("#product-title")!, "Sourdough Loaf"),
    );

    // Move to Step 1 -> select ready image -> enter alt text
    await goToStep("Photos & options");
    const selectImgBtn = [...host.querySelectorAll("button")].find((b) =>
      b.getAttribute("aria-label")?.includes(READY_ASSET.publicReference),
    )!;
    await act(async () => selectImgBtn.click());
    await act(async () =>
      setControlValue(host.querySelector<HTMLInputElement>("#catalog-media-alt-0")!, "Golden crust loaf"),
    );

    // Move to Step 2 -> fill packaging & 0.00 price
    await goToStep("Offer & stock");
    await act(async () => {
      setControlValue(host.querySelector<HTMLInputElement>("#vendor-package-lengthCm")!, "25");
      setControlValue(host.querySelector<HTMLInputElement>("#vendor-package-widthCm")!, "15");
      setControlValue(host.querySelector<HTMLInputElement>("#vendor-package-heightCm")!, "10");
      setControlValue(host.querySelector<HTMLInputElement>("#vendor-package-weightKg")!, "0.8");
      setControlValue(host.querySelector<HTMLTextAreaElement>("#vendor-package-description")!, "Kraft bread bag");
      setControlValue(host.querySelector<HTMLInputElement>("#store-sku")!, "LOAF-001");
      setControlValue(host.querySelector<HTMLInputElement>("#selling-price-zar")!, "0.00");
      setControlValue(host.querySelector<HTMLInputElement>("#opening-stock")!, "5");
      setControlValue(host.querySelector<HTMLSelectElement>("#inventory-location")!, "LOC-JHB-1");
    });

    // Attempt submit from Step 3 -> should jump back to Step 0 because required Flavour attribute is missing
    await goToStep("Review & save");
    const submitBtn = [...host.querySelectorAll("button")].find((b) =>
      b.textContent === "Save product draft",
    )!;
    await act(async () => submitBtn.click());
    expect(host.querySelector("#catalog-error-summary")?.textContent).toContain(
      "Enter required attribute: Flavour.",
    );
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain("Product details");

    // Fill required Flavour attribute on Step 0, omit compliance on Step 1 -> jumps to Step 1
    await act(async () =>
      setControlValue(host.querySelector<HTMLInputElement>("#attr-flavour")!, "Olive rosemary"),
    );
    await goToStep("Review & save");
    await act(async () => submitBtn.click());
    expect(host.querySelector("#catalog-error-summary")?.textContent).toContain(
      "Enter required compliance field: Allergen disclosure.",
    );
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain("Photos & options");

    // Fill required compliance on Step 1 -> remaining error is 0.00 price on Step 2 -> jumps to Step 2
    await act(async () =>
      setControlValue(host.querySelector<HTMLInputElement>("#compliance-allergens")!, "Contains wheat"),
    );
    await goToStep("Review & save");
    await act(async () => submitBtn.click());
    expect(host.querySelector("#catalog-error-summary")?.textContent).toContain(
      "Enter a positive ZAR selling price with two decimal places.",
    );
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain("Offer & stock");
  });

  it("builds modifiers without raw JSON typing and submits truthful priceIncludesTax per vatContext", async () => {
    await renderWizard({ defaultPriceIncludesTax: true, vatNote: "Includes 15% VAT" });

    const categorySelect = host.querySelector<HTMLSelectElement>("select")!;
    await act(async () => setControlValue(categorySelect, "catbakery000000000000001"));
    await act(async () => setControlValue(host.querySelector<HTMLInputElement>("#product-title")!, "Artisan Tart"));
    await act(async () => setControlValue(host.querySelector<HTMLInputElement>("#attr-flavour")!, "Dark chocolate"));

    await goToStep("Photos & options");
    const selectImgBtn = [...host.querySelectorAll("button")].find((b) =>
      b.getAttribute("aria-label")?.includes(READY_ASSET.publicReference),
    )!;
    await act(async () => selectImgBtn.click());
    await act(async () => setControlValue(host.querySelector<HTMLInputElement>("#catalog-media-alt-0")!, "Chocolate tart photo"));
    await act(async () => setControlValue(host.querySelector<HTMLInputElement>("#compliance-allergens")!, "Wheat and dairy"));

    const addModGroupBtn = [...host.querySelectorAll("button")].find((b) =>
      b.textContent === "Add modifier group",
    )!;
    await act(async () => addModGroupBtn.click());
    await act(async () => setControlValue(host.querySelector<HTMLInputElement>("#mod-group-0-name")!, "Gift finish"));
    await act(async () => setControlValue(host.querySelector<HTMLInputElement>("#mod-0-opt-0-name")!, "Ribbon box"));
    await act(async () => setControlValue(host.querySelector<HTMLInputElement>("#mod-0-opt-0-price")!, "15.00"));

    await goToStep("Offer & stock");
    expect(host.textContent).toContain("Includes 15% VAT");
    await act(async () => setControlValue(host.querySelector<HTMLInputElement>("#vendor-package-lengthCm")!, "20"));
    await act(async () => setControlValue(host.querySelector<HTMLInputElement>("#vendor-package-widthCm")!, "20"));
    await act(async () => setControlValue(host.querySelector<HTMLInputElement>("#vendor-package-heightCm")!, "10"));
    await act(async () => setControlValue(host.querySelector<HTMLInputElement>("#vendor-package-weightKg")!, "0.6"));
    await act(async () => setControlValue(host.querySelector<HTMLTextAreaElement>("#vendor-package-description")!, "Artisan cake box with protective padding"));
    await act(async () => setControlValue(host.querySelector<HTMLInputElement>("#store-sku")!, "TART-01"));
    await act(async () => setControlValue(host.querySelector<HTMLInputElement>("#selling-price-zar")!, "95.00"));
    await act(async () => setControlValue(host.querySelector<HTMLInputElement>("#opening-stock")!, "4"));
    await act(async () => setControlValue(host.querySelector<HTMLSelectElement>("#inventory-location")!, "LOC-JHB-1"));

    await goToStep("Review & save");
    const submitBtn = [...host.querySelectorAll("button")].find((b) =>
      b.textContent === "Save product draft",
    )!;
    await act(async () => submitBtn.click());

    expect(host.querySelector("#catalog-error-summary")?.textContent ?? "").toBe("");
    expect(host.textContent).toContain("Listing draft saved");
    const postCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/api/store/catalog/listing-drafts"),
    );
    expect(postCall).toBeDefined();
    const submitted = JSON.parse(String(postCall![1]?.body));
    expect(submitted.product.attributeValues).toEqual({ flavour: "Dark chocolate" });
    expect(submitted.product.complianceValues).toEqual({ allergens: "Wheat and dairy" });
    expect(submitted.price).toMatchObject({ amount: "95.00", currency: "ZAR", priceIncludesTax: true });
    expect(submitted.modifiers).toEqual([
      {
        name: "Gift finish",
        minimumSelections: 0,
        maximumSelections: 1,
        isRequired: false,
        options: [{ name: "Ribbon box", priceDelta: "15.00", currency: "ZAR", displayOrder: 0 }],
      },
    ]);
  });
});
