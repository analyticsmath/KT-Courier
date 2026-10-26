// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InventoryCsvUpload } from "@/components/store/InventoryCsvUpload";
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
let host: HTMLDivElement, root: Root;
const row = { inventoryReference: "CII-TEST", locationReference: "CIL-TEST", version: 4, label: "USB cable (CABLE-1)", locationName: "Stockroom" };
const preview = { ...row, quantity: 2, onHand: 3, resultingOnHand: 5 };
function button(name: string) { return Array.from(host.querySelectorAll("button")).find(button => button.textContent === name)!; }
async function click(name: string) { await act(async () => button(name).click()); }
async function input(id: string, value: string) {
  const element = host.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
async function prepare() { await input("receipt-product", row.inventoryReference); await input("receipt-quantity", "2"); await click("Prepare stock receipt"); }
const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(InventoryCsvUpload, { template: [row] })));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("prepares a named product receipt, reviews without saving and applies only after confirmation", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({ dryRun: true, preview: [preview] })).mockResolvedValueOnce(response({ movements: [{}] })); vi.stubGlobal("fetch", fetch);
  await prepare(); expect(fetch).not.toHaveBeenCalled();
  await click("Review stock changes");
  expect(host.querySelector('[aria-label="Reviewed stock changes"]')!.textContent).toContain("USB cable (CABLE-1) · Stockroom: 3 + 2 = 5");
  expect(JSON.parse(fetch.mock.calls[0][1].body).dryRun).toBe(true);
  await click("Apply received stock");
  const reviewed = JSON.parse(fetch.mock.calls[0][1].body), applied = JSON.parse(fetch.mock.calls[1][1].body);
  expect(applied).toEqual({ ...reviewed, dryRun: false }); expect(applied.csv).toContain("CII-TEST,CIL-TEST,4,2");
  expect(host.textContent).toContain("Stock receipt recorded for 1 items.");
});
it("retries an unconfirmed apply with the same operation and locks replacement inputs", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({ dryRun: true, preview: [preview] })).mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(response({ movements: [{}] })); vi.stubGlobal("fetch", fetch);
  await prepare(); await click("Review stock changes"); await click("Apply received stock");
  expect(host.textContent).toContain("Keep this page open"); expect(host.querySelector<HTMLInputElement>('#inventory-csv')!.disabled).toBe(true);
  expect(host.querySelector<HTMLInputElement>('#receipt-quantity')!.matches(":disabled")).toBe(true);
  await click("Retry unconfirmed stock receipt");
  expect(fetch.mock.calls[2][1].body).toBe(fetch.mock.calls[1][1].body);
});
it("requires a new review when the received quantity changes", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ dryRun: true, preview: [preview] })));
  await prepare(); await click("Review stock changes"); await input("receipt-quantity", "3");
  expect(button("Apply received stock")).toBeUndefined(); expect(button("Review stock changes").disabled).toBe(true);
});
it("blocks non-positive and fractional stock quantities before sending a request", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  await input("receipt-product", row.inventoryReference);
  for (const value of ["0", "-1", "1.5"]) {
    await input("receipt-quantity", value); await click("Prepare stock receipt");
    expect(host.querySelector('[role="alert"]')!.textContent).toMatch(/invalid|positive whole-unit/);
    expect(button("Review stock changes").disabled).toBe(true);
  }
  expect(fetch).not.toHaveBeenCalled();
});
