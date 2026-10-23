// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { DriverDeliveryEvidencePanel } from "@/components/driver/DriverDeliveryEvidencePanel";

it("opens a photo picker, rejects unsupported evidence and waits for server acceptance before using proof", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Storage unavailable. Try again." }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ evidenceReference: "proof-accepted" }) });
  vi.stubGlobal("fetch", fetcher);
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host); const onProof = vi.fn();
  try {
    await act(async () => root.render(React.createElement(DriverDeliveryEvidencePanel, { assignmentId: "assignment", assignmentVersion: 3, onProof })));
    const file = host.querySelector('input[type="file"]') as HTMLInputElement;
    const submit = host.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const picker = vi.spyOn(file, "click");
    (Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Choose delivery photo")!).click();
    expect(picker).toHaveBeenCalledOnce(); picker.mockRestore();
    async function choose(value: File) {
      Object.defineProperty(file, "files", { configurable: true, value: [value] });
      await act(async () => file.dispatchEvent(new Event("change", { bubbles: true })));
    }
    await choose(new File(["pdf"], "wrong.pdf", { type: "application/pdf" }));
    expect(submit.disabled).toBe(true); expect(fetcher).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("JPEG, PNG or WebP");
    await choose(new File(["photo"], "handover.jpg", { type: "image/jpeg" }));
    expect(submit.disabled).toBe(false);
    const form = host.querySelector("form")!;
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(onProof).not.toHaveBeenCalled(); expect(submit.disabled).toBe(false);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Storage unavailable");
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(onProof).toHaveBeenCalledExactlyOnceWith("proof-accepted");
    expect(fetcher.mock.calls[1][1].body.get("assignmentVersion")).toBe("3");
    expect(submit.disabled).toBe(true);
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Private proof uploaded: handover.jpg");
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});
