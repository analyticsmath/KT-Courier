// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileAvatar } from "@/components/forms/ProfileAvatar";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
let host: HTMLDivElement, root: Root;
const request = vi.fn();
const revoke = vi.fn();
function uploadButton() { return [...host.querySelectorAll("button")].find(b => b.textContent === "Upload image")!; }
async function choose(file: File) { await act(async () => { const input = host.querySelector("input")!; Object.defineProperty(input, "files", { configurable: true, value: [file] }); input.dispatchEvent(new Event("change", { bubbles: true })); }); }
async function submit() { await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", request); request.mockReset(); revoke.mockReset(); refresh.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:test-preview"); URL.revokeObjectURL = revoke;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); await act(async () => root.render(React.createElement(ProfileAvatar)));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
describe("profile image controls", () => {
  it("provides a labelled native picker and a readable disabled upload action", () => { expect(host.querySelector('label[for="profile-avatar"]')).not.toBeNull(); expect(uploadButton().disabled).toBe(true); expect(host.textContent).toContain("then select Upload image"); });
  it("previews a valid file and submits it to the authenticated avatar endpoint", async () => {
    request.mockResolvedValue({ ok: true, json: async () => ({ saved: true }) });
    await choose(new File(["bytes"], "profile.png", { type: "image/png" })); expect(uploadButton().disabled).toBe(false); expect(host.querySelector("img")?.alt).toContain("preview"); await submit();
    expect(request).toHaveBeenCalledWith("/api/platform/avatar", expect.objectContaining({ method: "POST", body: expect.any(FormData) })); expect(refresh).toHaveBeenCalledOnce(); expect(uploadButton().disabled).toBe(true); expect(host.textContent).toContain("Profile image updated"); expect(revoke).toHaveBeenCalledWith("blob:test-preview");
  });
  it("rejects unsupported images before sending bytes", async () => { await choose(new File(["<svg/>"], "image.svg", { type: "image/svg+xml" })); expect(uploadButton().disabled).toBe(true); expect(host.textContent).toContain("Choose a JPEG"); expect(request).not.toHaveBeenCalled(); });
  it("keeps the selected file available after a failed upload", async () => { request.mockResolvedValue({ ok: false, json: async () => ({ error: "Image storage unavailable" }) }); await choose(new File(["bytes"], "profile.webp", { type: "image/webp" })); await submit(); expect(host.textContent).toContain("Image storage unavailable"); expect(uploadButton().disabled).toBe(false); expect(refresh).not.toHaveBeenCalled(); });
});
