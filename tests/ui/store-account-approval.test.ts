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
    const button = [...host.querySelectorAll("button")].find((item) => item.textContent?.includes("Approve vendor account"));
    expect(button).toBeDefined();
    await act(async () => {
      button!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/stores/store-123/status", expect.objectContaining({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    }));
    expect(host.textContent).toContain("Vendor account approved.");
    expect(host.textContent).toContain("Seller identity and catalog review remain separate.");
    expect(refresh).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
