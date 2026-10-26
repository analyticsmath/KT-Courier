// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { CatalogMediaUploader } from "@/components/catalog/CatalogMediaUploader";

afterEach(() => vi.unstubAllGlobals());

it("excludes store branding and unknown purposes from product selection", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ assets:
    ["PRODUCT_IMAGE", "VARIANT_IMAGE", "STORE_LOGO", "STORE_HERO", "UNKNOWN"].map(purpose => ({ publicReference: purpose, purpose, status: "READY", mimeType: "image/webp", byteSize: 100, width: 400, height: 400 }))
  }) }));
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const onChange = vi.fn();
  try {
    await act(async () => root.render(createElement(CatalogMediaUploader, { value: [], onChange })));
    const choices = [...host.querySelectorAll("button[aria-label^='Select ']")];
    expect(choices.map(button => button.getAttribute("aria-label"))).toEqual(["Select PRODUCT_IMAGE", "Select VARIANT_IMAGE"]);
    await act(async () => (choices[1] as HTMLButtonElement).click());
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ variantAssociation: "DEFAULT", primary: false })]);
    await act(async () => root.render(createElement(CatalogMediaUploader, { value: [], onChange, productOnly: true })));
    expect([...host.querySelectorAll("button[aria-label^='Select ']")].map(button => button.getAttribute("aria-label"))).toEqual(["Select PRODUCT_IMAGE"]);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
