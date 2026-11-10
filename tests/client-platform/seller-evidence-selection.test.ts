// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { StoreSellerIdentityForm } from "@/components/store/StoreSellerIdentityForm";

afterEach(() => vi.unstubAllGlobals());
it("clears the previously uploaded reference when a different document is selected", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ document: { publicReference: "PMO-12345678-1234-1234-1234-123456789012" } }) }));
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => { root.render(React.createElement(StoreSellerIdentityForm, { currentReference: null })); });
    const input = host.querySelector<HTMLInputElement>('#seller-evidence-file')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["first"], "first.pdf", { type: "application/pdf" })] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
    const button = Array.from(host.querySelectorAll("button")).find(item => item.textContent === "Upload supporting document")!;
    await act(async () => { button.click(); });
    const reference = host.querySelector<HTMLInputElement>('#seller-evidence-reference')!;
    expect(reference.value).toBe("PMO-12345678-1234-1234-1234-123456789012");
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["second"], "second.pdf", { type: "application/pdf" })] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(reference.value).toBe("");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
