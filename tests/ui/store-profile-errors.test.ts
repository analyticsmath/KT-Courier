// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { StoreProfileForm } from "@/components/forms/StoreProfileForm";
import { StoreProfileUpdateSchema } from "@/lib/validation/profile";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
it("shows the API field errors and retains values for correction", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Validation failed.", fields: { businessEmail: "Enter a valid email address" } }) }));
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(StoreProfileForm, { defaultValues: { storeName: "Test store", contactPerson: "Owner", businessEmail: "bad-address" } })));
    await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(host.textContent).toContain("Enter a valid email address");
    expect(host.querySelector<HTMLInputElement>("#sp_business_email")!.value).toBe("bad-address");
    expect(host.querySelector<HTMLInputElement>("#sp_business_email")!.getAttribute("aria-invalid")).toBe("true");
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
it("submits blank optional contacts for clearing and blocks duplicate submissions while saving", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let finish!: (value: unknown) => void;
  const fetch = vi.fn(() => new Promise(resolve => { finish = resolve; })); vi.stubGlobal("fetch", fetch);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(StoreProfileForm, { defaultValues: { storeName: "Test store", contactPerson: "Owner" } })));
    await act(async () => { const form = host.querySelector("form")!; form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetch.mock.calls[0] as unknown as [string, { body: string }])[1].body)).toMatchObject({ businessPhone: "", businessEmail: "" });
    expect(host.querySelector("fieldset")!.disabled).toBe(true);
    await act(async () => finish({ ok: true, json: async () => ({}) }));
    expect(host.querySelector('[role="status"]')!.textContent).toBe("Changes saved");
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
it("rejects whitespace-only business names and contact names", () => {
  expect(StoreProfileUpdateSchema.safeParse({ storeName: "   " }).success).toBe(false);
  expect(StoreProfileUpdateSchema.safeParse({ contactPerson: "   " }).success).toBe(false);
});
