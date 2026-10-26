// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { StoreOfferAvailability } from "@/components/catalog/StoreOfferAvailability";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
it.each(["ACTIVE", "PAUSED"])("retries an unconfirmed %s listing change with the identical operation", async status => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const action = status === "ACTIVE" ? "pause" : "resume";
  const fetch = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce({ ok: true, json: async () => ({ offer: { publicReference: "CO-test", status: action === "pause" ? "PAUSED" : "ACTIVE" } }) });
  vi.stubGlobal("fetch", fetch);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(StoreOfferAvailability, { reference: "CO-test", version: 4, status })));
    await act(async () => host.querySelector("button")!.click());
    expect(host.querySelector('[role="alert"]')!.textContent).toContain("Retry to check the same request");
    await act(async () => host.querySelector("button")!.click());
    expect(fetch.mock.calls[0][0]).toBe(`/api/store/catalog/offers/CO-test/${action}`);
    expect(fetch.mock.calls[1][1].body).toBe(fetch.mock.calls[0][1].body);
    expect(host.querySelector("button")!.disabled).toBe(true);
    expect(host.querySelector('[role="status"]')!.textContent).toContain(action === "pause" ? "Listing paused" : "Listing resumed");
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
it("does not expose pause/resume for a draft awaiting review", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); const root = createRoot(host);
  try { await act(async () => root.render(createElement(StoreOfferAvailability, { reference: "CO-test", version: 1, status: "DRAFT" }))); expect(host.querySelector("button")).toBeNull(); }
  finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
