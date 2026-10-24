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
it("requires a reviewed baseline for receipt-free recovery and preserves unrelated overrides", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); localStorage.clear();
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: { overrides: [{ permissionKey: "other.read", effect: "DENY", reason: "retain" }, { permissionKey: "commercial_configuration.manage", effect: "ALLOW", reason: "temporary" }] } }) }).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetcher); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(CommercialReviewerAccessForm, { employees: [{ id: "reviewer", label: "Reviewer" }] })));
    const remove = [...host.querySelectorAll("button")].find(item => item.textContent === "Remove reviewed commercial override")!;
    expect(remove.disabled).toBe(true);
    await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    await act(async () => remove.click());
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ mode: "REPLACE", overrides: [{ permissionKey: "other.read", effect: "DENY", reason: "retain" }] });
  } finally { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.unstubAllGlobals(); }
});

it("isolates temporary commission approval access from commercial packaging grants", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); localStorage.clear();
  localStorage.setItem("kt-temporary-commercial-review:reviewer", "null");
  const reply = (overrides: unknown[]) => ({ ok: true, json: async () => ({ data: { overrides } }) });
  const fetcher = vi.fn().mockResolvedValueOnce(reply([{ permissionKey: "commercial_configuration.manage", effect: "ALLOW", reason: "separate review" }])).mockResolvedValueOnce(reply([])).mockResolvedValueOnce(reply([{ permissionKey: "commercial_configuration.manage", effect: "ALLOW", reason: "separate review" }, { permissionKey: "commission_plans.approve", effect: "ALLOW", reason: "temporary" }])).mockResolvedValueOnce(reply([]));
  vi.stubGlobal("fetch", fetcher); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(CommercialReviewerAccessForm, { kind: "commission", employees: [{ id: "reviewer", label: "Reviewer" }] })));
    await act(async () => [...host.querySelectorAll("button")].find(item => item.textContent === "Grant reviewer access")!.click());
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ mode: "MERGE", overrides: [{ permissionKey: "commission_plans.approve", effect: "ALLOW" }] });
    await act(async () => [...host.querySelectorAll("button")].find(item => item.textContent === "Restore original reviewer access")!.click());
    expect(JSON.parse(fetcher.mock.calls[3][1].body)).toEqual({ mode: "REPLACE", overrides: [{ permissionKey: "commercial_configuration.manage", effect: "ALLOW", reason: "separate review" }] });
    expect(localStorage.getItem("kt-temporary-commission-review:reviewer")).toBeNull();
    expect(localStorage.getItem("kt-temporary-commercial-review:reviewer")).toBe("null");
  } finally { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.unstubAllGlobals(); }
});
