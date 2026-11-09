// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VerifyOtpForm } from "@/app/(auth)/verify-otp/VerifyOtpForm";

const routerPush = vi.hoisted(() => vi.fn());
vi.mock("next/font/local", () => ({ default: () => ({ className: "", variable: "" }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

afterEach(() => vi.unstubAllGlobals());

describe("verification screen delivery status", () => {
  it("does not claim the provider rejected an OTP email when the API only returned a privacy-preserving pending indicator", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => {
        root.render(React.createElement(VerifyOtpForm, {
          email: "verification@example.test",
          maskedEmail: "v••••@example.test",
          deliveryPending: true,
        }));
      });
      expect(host.textContent).toContain("Enter the verification code");
      expect(host.textContent).not.toMatch(/email was not accepted by the mail provider/i);
      expect(host.querySelector('[role="alert"]')).toBeNull();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
  it("shows password setup guidance only after a passwordless account verifies its code", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ redirect: "/store", requiresPasswordSetup: true }) }));
    routerPush.mockClear();
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => { root.render(React.createElement(VerifyOtpForm, { email: "vendor@example.test", maskedEmail: "v•••@example.test" })); });
      const input = host.querySelector<HTMLInputElement>('input[name="otp"]');
      const form = host.querySelector("form");
      expect(input).not.toBeNull(); expect(form).not.toBeNull();
      input!.value = "123456";
      await act(async () => { form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
      expect(host.textContent).toContain("Your existing account needs a password");
      expect(routerPush).not.toHaveBeenCalled();
      const button = Array.from(host.querySelectorAll("button")).find(item => item.textContent === "Set a password");
      await act(async () => { button!.click(); });
      expect(routerPush).toHaveBeenCalledWith("/forgot-password");
    } finally {
      await act(async () => root.unmount()); host.remove();
    }
  });
});
