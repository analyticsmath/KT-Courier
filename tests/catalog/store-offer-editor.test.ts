// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoreOfferEditor } from "@/components/catalog/StoreOfferEditor";

const f = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: f.refresh }) }));

const reference = `CO-${"A".repeat(32)}`;
const props = {
  offer: { publicReference: reference, version: 4, status: "NEEDS_CHANGES", merchantTitle: "Old title", merchantDescription: null, fulfilmentMode: "COURIER_DELIVERY", primaryInventoryLocationId: null },
  locations: [{ id: "clocation0000000000000001", name: "Main stock" }], canManage: true, canPrice: true,
  initialPrice: "25.00", initialEffectiveFrom: "2026-10-14T10:15:00.000Z",
};
let container: HTMLDivElement; let root: Root; let fetcher: ReturnType<typeof vi.fn>;
async function render(input = props) { await act(async () => { root.render(createElement(StoreOfferEditor, { ...input, key: `${input.offer.publicReference}:${input.offer.version}` })); }); }
async function submit(name: string) {
  await act(async () => { container.querySelector<HTMLFormElement>(`form[aria-label="${name}"]`)!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}
function field(name: string, value: string) { container.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!.value = value; }

describe("vendor offer correction commands", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

  it("saves corrected offer fields using the canonical versioned PATCH API", async () => {
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ offer: { publicReference: reference, version: 5 } }) });
    await render(); field("merchantTitle", "Correct title"); field("fulfilmentMode", "STORE_PICKUP"); field("location", props.locations[0].id);
    await submit("Correct offer details");
    const [path, request] = fetcher.mock.calls[0];
    expect(path).toBe(`/api/store/catalog/offers/${reference}`); expect(request.method).toBe("PATCH");
    expect(JSON.parse(request.body)).toMatchObject({ version: 4, merchantTitle: "Correct title", merchantDescription: null, fulfilmentMode: "STORE_PICKUP", primaryInventoryLocationId: props.locations[0].id });
    expect(f.refresh).toHaveBeenCalledOnce();
  });

  it("creates an exact VAT-inclusive draft price with UTC dates and current offer version", async () => {
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ price: { publicReference: `CPR-${"B".repeat(32)}` } }) });
    await render(); field("amount", "30.50"); field("effectiveUntil", "2026-11-01T00:00"); await submit("Correct draft price");
    const [path, request] = fetcher.mock.calls[0];
    expect(path).toBe("/api/store/catalog/prices"); expect(request.method).toBe("POST");
    expect(JSON.parse(request.body)).toMatchObject({ offerPublicReference: reference, offerVersion: 4, amount: "30.50", currency: "ZAR", priceIncludesTax: true, effectiveFrom: "2026-10-14T10:15:00.000Z", effectiveUntil: "2026-11-01T00:00:00.000Z" });
    expect(container.textContent).toContain("draft price was saved for independent review");
  });

  it("rejects malformed prices and end-before-start periods before sending a command", async () => {
    await render(); field("amount", "30.5"); await submit("Correct draft price"); expect(fetcher).not.toHaveBeenCalled();
    field("amount", "30.50"); field("effectiveUntil", "2026-10-01T00:00"); await submit("Correct draft price"); expect(fetcher).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("two decimal places");
  });

  it("keeps server conflict errors visible without claiming success or refreshing", async () => {
    fetcher.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "Conflict" }) });
    await render(); await submit("Correct draft price");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Refresh and review"); expect(f.refresh).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("");
  });

  it("guards unavailable actions and preserves price-only permissions", async () => {
    await render({ ...props, canManage: false }); expect(container.querySelector('[aria-label="Correct offer details"]')).toBeNull();
    expect(container.querySelector('[aria-label="Correct draft price"]')).not.toBeNull();
    await render({ ...props, offer: { ...props.offer, status: "ACTIVE" } }); expect(container.querySelector("form")).toBeNull();
  });

  it("allows a price correction after remounting the authoritative offer-version key", async () => {
    fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ offer: { publicReference: reference, version: 5 } }) });
    await render(); await submit("Correct offer details");
    expect(container.querySelector<HTMLButtonElement>('form[aria-label="Correct draft price"] button')?.disabled).toBe(true);
    await render({ ...props, offer: { ...props.offer, version: 5 } });
    expect(container.querySelector<HTMLButtonElement>('form[aria-label="Correct draft price"] button')?.disabled).toBe(false);
    fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ price: { publicReference: `CPR-${"C".repeat(32)}` } }) });
    await submit("Correct draft price");
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ offerVersion: 5 });
  });
});
