// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CommercialReviewerAccessForm } from "@/components/admin/CommercialReviewerAccessForm";
it("restores the original commercial override while preserving unrelated permissions changed during review", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); localStorage.clear();
  const reply = (overrides: unknown[]) => ({ ok: true, json: async () => ({ data: { overrides } }) });
  const fetcher = vi.fn().mockResolvedValueOnce(reply([{ permissionKey: "other.read", effect: "ALLOW", reason: "original" }, { permissionKey: "commercial_configuration.manage", effect: "DENY", reason: "original deny" }])).mockResolvedValueOnce(reply([])).mockResolvedValueOnce(reply([{ permissionKey: "other.read", effect: "DENY", reason: "subsequently changed" }, { permissionKey: "commercial_configuration.manage", effect: "ALLOW", reason: "temporary" }])).mockResolvedValueOnce(reply([]));
  vi.stubGlobal("fetch", fetcher); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(CommercialReviewerAccessForm, { employees: [{ id: "reviewer", label: "Reviewer" }] })));
    await act(async () => [...host.querySelectorAll("button")].find(item => item.textContent === "Grant reviewer access")!.click());
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ mode: "MERGE", overrides: [{ permissionKey: "commercial_configuration.manage", effect: "ALLOW" }] });
    await act(async () => [...host.querySelectorAll("button")].find(item => item.textContent === "Restore original reviewer access")!.click());
    expect(JSON.parse(fetcher.mock.calls[3][1].body)).toEqual({ mode: "REPLACE", overrides: [{ permissionKey: "other.read", effect: "DENY", reason: "subsequently changed" }, { permissionKey: "commercial_configuration.manage", effect: "DENY", reason: "original deny" }] });
    expect(localStorage.getItem("kt-temporary-commercial-review:reviewer")).toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.unstubAllGlobals(); }
});
