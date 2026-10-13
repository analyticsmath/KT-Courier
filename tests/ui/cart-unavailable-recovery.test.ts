// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CartExperience } from "@/components/public-v2/commerce/CartExperience";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return { default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement("a", { href, ...props }, children) };
});
vi.mock("next/image", async () => {
  const React = await import("react");
  return { default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement("img", props) };
});
vi.mock("motion/react", async () => {
  const React = await import("react");
  const MotionListItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement> & { initial?: unknown; animate?: unknown; exit?: unknown; layout?: unknown; transition?: unknown }>(function MotionListItem(props, ref) {
    const { initial, animate, exit, layout, transition, ...elementProps } = props;
    void initial; void animate; void exit; void layout; void transition;
    return React.createElement("li", { ...elementProps, ref });
  });
  return {
    motion: { li: MotionListItem },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

const populatedCart = {
  reference: "cart_guest_1", status: "ACTIVE", currency: "ZAR", version: 1, itemCount: 1,
  totals: { merchandiseSubtotal: "154.00", modifierSubtotal: "0.00", grandTotal: "154.00" },
  storeGroups: [{ storeId: "store_1", storeReference: "store_ref_1", storeName: "Test Store", storeSlug: "test-store", fulfilmentMode: "COURIER_DELIVERY", totals: { merchandiseSubtotal: "154.00", modifierSubtotal: "0.00", subtotal: "154.00" }, lines: [{ reference: "line_1", productReference: "product_1", variantReference: "variant_1", offerReference: "offer_1", title: "Test item", variantTitle: null, quantity: 1, baseUnitPrice: "154.00", modifierUnitTotal: "0.00", effectiveUnitPrice: "154.00", lineTotal: "154.00", modifiers: [] }] }],
};
const emptyCart = { ...populatedCart, version: 2, itemCount: 0, totals: { merchandiseSubtotal: "0.00", modifierSubtotal: "0.00", grandTotal: "0.00" }, storeGroups: [] };
const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

let host: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

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

it("reloads the canonical cart and explains a missing cart reference after remove", async () => {
  fetchMock
    .mockResolvedValueOnce(reply(200, { cart: populatedCart }))
    .mockResolvedValueOnce(reply(404, { error: "Cart is unavailable." }))
    .mockResolvedValueOnce(reply(200, { cart: emptyCart }));

  await act(async () => root.render(React.createElement(CartExperience)));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  const remove = [...host.querySelectorAll("button")].find((button) => button.textContent === "Remove");
  expect(remove).toBeDefined();

  await act(async () => {
    remove!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(host.textContent).toContain("Your cart is empty");
  expect(host.textContent).toContain("We refreshed it; review your cart and try again.");
});
