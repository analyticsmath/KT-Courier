// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { StoreAccountApproval } from "@/components/admin/StoreAccountApproval";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockReset();
});

it("activates the reviewed vendor account through the permission-protected status API", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ACTIVE" }) });
  vi.stubGlobal("fetch", fetchMock);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  try {
    await act(async () => root.render(React.createElement(StoreAccountApproval, { storeId: "store-123" })));
    const button = [...host.querySelectorAll("button")].find((item) => item.textContent?.includes("Approve business account"));
    const acknowledgement = host.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    const reasonInput = host.querySelector('input[type="text"]') as HTMLInputElement | null;
    expect(button).toBeDefined();
    expect(acknowledgement).not.toBeNull();
    expect(reasonInput).not.toBeNull();
    expect(reasonInput?.value).toBe("");
    expect(button?.disabled).toBe(true);
    await act(async () => {
      button!.click();
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();

    // Checkbox alone is not enough when review statement is empty or too short.
    await act(async () => {
      acknowledgement!.click();
    });
    expect(button?.disabled).toBe(true);

    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(reasonInput, "Too short");
      reasonInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(button?.disabled).toBe(true);

    await act(async () => {
      setValue?.call(reasonInput, "Verified owner identity email, phone number, and South African trading contact.");
      reasonInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(button?.disabled).toBe(false);

    await act(async () => {
      button!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/stores/store-123/status", expect.objectContaining({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "ACTIVE",
        reason: "Verified owner identity email, phone number, and South African trading contact.",
      }),
    }));
    expect(host.textContent).toContain("Business account approved.");
    expect(host.textContent).toContain("seller identity, pickup readiness, catalog approval, and checkout capability certification pass.");
    expect(refresh).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
