// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CheckoutExperience } from "@/components/public-v2/commerce/CheckoutExperience";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("ref=checkout_test") }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return { default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement("a", { href, ...props }, children) };
});
vi.mock("@/components/maps/AddressAutocomplete", () => ({ AddressAutocomplete: () => null }));
vi.mock("@/components/public-v2/commerce/GuestCheckoutEmailUpdates", () => ({ GuestCheckoutEmailUpdates: () => null }));

const checkout = {
  reference: "checkout_test", status: "CREATED", currency: "ZAR", version: 1,
  totals: { merchandiseSubtotal: "154.00", modifierSubtotal: "0.00", deliveryFeeTotal: "0.00", grandTotal: "154.00" },
  storeGroups: [{ storeReference: "store_ref_1", storeName: "Test Store", storeSlug: "test-store", status: "OPEN", fulfilmentMode: "COURIER_DELIVERY", lines: [{ productReference: "product_1", productTitle: "Test item", variantReference: "variant_1", variantTitle: null, offerReference: "offer_1", quantity: 1, baseUnitPrice: "154.00", modifierUnitTotal: "0.00", lineTotal: "154.00", modifiers: [] }] }],
};
const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

let host: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("crypto", { randomUUID: () => "operation-1", subtle: { digest: async () => new ArrayBuffer(32) } });
  fetchMock.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("gives checkout customers a coverage and operations path when route verification blocks delivery", async () => {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/delivery-services")) return reply(200, { model: "MATRIX", services: [] });
    if (url.endsWith("/contact")) return reply(200, { checkout: { ...checkout, version: 2 } });
    if (url.endsWith("/delivery-address")) return reply(422, { code: "CHECKOUT_REVIEW_REQUIRED", error: "Delivery is not available at this address in the currently active service areas." });
    if (url === "/api/checkout/checkout_test") return reply(200, { checkout });
    throw new Error(`Unexpected checkout request: ${url}`);
  });

  await act(async () => root.render(React.createElement(CheckoutExperience)));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  await act(async () => {
  setInputValue(host.querySelector<HTMLInputElement>("#contactName")!, "Test Customer");
  setInputValue(host.querySelector<HTMLInputElement>("#contactEmail")!, "customer@example.test");
  setInputValue(host.querySelector<HTMLInputElement>("#contactPhone")!, "0821234567");
  });
  await submit(host.querySelector<HTMLFormElement>('form[aria-labelledby="checkout-contact-heading"]')!);

  expect(host.querySelector<HTMLInputElement>("#addrLine1")).not.toBeNull();
  await act(async () => {
  setInputValue(host.querySelector<HTMLInputElement>("#addrLine1")!, "10 Main Road");
  setInputValue(host.querySelector<HTMLInputElement>("#addrCity")!, "Johannesburg");
  });
  await submit(host.querySelector<HTMLFormElement>('form[aria-labelledby="checkout-address-heading"]')!);

  expect(host.textContent).toContain("Delivery is not available at this address");
  expect(host.textContent).toContain("Delivery availability must be confirmed for this address, active service, and route.");
  expect([...host.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toContain("/coverage-areas");
  expect([...host.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toContain("/contact");
});
