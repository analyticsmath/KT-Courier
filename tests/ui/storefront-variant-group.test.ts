import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { expect, it, vi } from "vitest";
import { ProductDetailExperience } from "@/components/public-v2/commerce/ProductDetailExperience";
import { document as fixtureDocument } from "../storefront/storefront-test-helpers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

type Element = DefaultTreeAdapterMap["element"];
type Parent = DefaultTreeAdapterMap["parentNode"];
const attribute = (element: Element, name: string) => element.attrs.find(attr => attr.name === name)?.value;
function elements(parent: Parent, predicate: (element: Element) => boolean): Element[] {
  return parent.childNodes.flatMap(node => "tagName" in node ? [...(predicate(node) ? [node] : []), ...elements(node, predicate)] : []);
}
function text(parent: Parent): string {
  return parent.childNodes.map(node => "value" in node ? node.value : "childNodes" in node ? text(node) : "").join("");
}

it("the real purchase region exposes one named chooser with one link per canonical variant despite multiple seller offers", () => {
  const product = fixtureDocument();
  const variant = fixtureDocument({ variantReference: "CV-11111111111111111111111111111111", offerReference: "CO-11111111111111111111111111111111", variantOptions: { size: "1 kg" }, price: { ...product.price, amount: "20.00" } });
  const anotherSeller = { ...variant, offerReference: "CO-22222222222222222222222222222222", storeReference: "other-store", storeSlug: "other-store" };
  const host = parseFragment(renderToStaticMarkup(createElement(ProductDetailExperience, { product, offers: [product, variant, anotherSeller], selectedVariantReference: product.variantReference })));
  const purchase = elements(host, element => element.tagName === "section" && attribute(element, "aria-label") === "Purchase product")[0];
  const groups = elements(purchase, element => attribute(element, "role") === "group" && attribute(element, "aria-label") === "Available product variants");
  expect(groups).toHaveLength(1);
  const links = elements(groups[0], element => element.tagName === "a");
  expect(links).toHaveLength(2);
  expect(links.map(link => text(link))).toEqual(["500 g", "1 kg"]);
  expect(new Set(links.map(link => attribute(link, "href"))).size).toBe(2);
  expect(links.filter(link => attribute(link, "href")?.endsWith(variant.variantReference))).toHaveLength(1);
  expect(text(purchase)).toMatch(/10,00/);
});
