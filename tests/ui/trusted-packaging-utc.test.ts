// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MarketplaceTrustedPackageManager } from "@/components/admin/MarketplaceTrustedPackageManager";
it("keeps explicit UTC packaging windows unchanged on a Pakistan-time browser", async () => {
  const priorTimezone = process.env.TZ; process.env.TZ = "Asia/Karachi";
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => [] }); vi.stubGlobal("fetch", fetcher);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(MarketplaceTrustedPackageManager, { initial: [], actorId: "reviewer", canManage: true })));
    expect(host.textContent).toContain("Packaging effective from (UTC)"); expect(host.textContent).toContain("Packaging effective until (UTC, optional)");
    const values = { storeId: "store", offerReference: "offer", variantReference: "variant", publicationVersion: "1", authorityReference: "controlled-test-measurement", reason: "Controlled UTC window test", lengthCm: "25", widthCm: "20", heightCm: "15", weightKg: "2.1", modifiers: "[]", effectiveFrom: "2026-10-24T02:00", effectiveTo: "2026-10-24T04:00" };
    for (const [name, value] of Object.entries(values)) host.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.value = value;
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(fetcher.mock.calls[0][0]).toBe("/api/admin/marketplace-trusted-packages");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ effectiveFrom: "2026-10-24T02:00:00.000Z", effectiveTo: "2026-10-24T04:00:00.000Z" });
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); if (priorTimezone === undefined) delete process.env.TZ; else process.env.TZ = priorTimezone; }
});
