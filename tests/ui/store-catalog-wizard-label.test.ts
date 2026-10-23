// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { StoreCatalogWizard } from "@/components/catalog/StoreCatalogWizard";

it("the real wizard connects the punctuated ZAR price label to one visible native input", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(React.createElement(StoreCatalogWizard, { productTypes: [], categories: Array.from({ length: 75 }, (_, index) => ({ id: `category-${index}`, name: `Category ${index}`, path: `/category-${index}`, parentId: null })), draftOwnerKey: "label-regression" })));
    const categoryLabel = [...host.querySelectorAll("label")].find(label => label.textContent === "Category")!;
    expect(categoryLabel).toBeDefined();
    expect(categoryLabel.control).toBeInstanceOf(HTMLSelectElement);
    expect((categoryLabel.control as HTMLSelectElement).id).toBe(categoryLabel.htmlFor);
    const categorySelect = categoryLabel.control as HTMLSelectElement;
    expect(categorySelect.options).toHaveLength(76);
    expect(host.querySelector('#find-a-category')).toBeNull();
    await act(async () => {
      categorySelect.value = "category-74";
      categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(categorySelect.value).toBe("category-74");
    const offerStep = [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Offer & stock") && button.closest("ol"))!;
    await act(async () => offerStep.click());
    const label = [...host.querySelectorAll("label")].find(label => label.textContent === "VAT-inclusive price (ZAR)")!;
    expect(label).toBeDefined();
    expect(label.control).toBeInstanceOf(HTMLInputElement);
    const input = label.control as HTMLInputElement;
    expect(input.id).toBe(label.htmlFor);
    expect(host.querySelectorAll(`[id="${input.id}"]`)).toHaveLength(1);
    expect(input.labels).toHaveLength(1);
    expect(input.hidden).toBe(false);
    expect(input.disabled).toBe(false);
    input.focus();
    expect(document.activeElement).toBe(input);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
