// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VerifyOtpForm } from "@/app/(auth)/verify-otp/VerifyOtpForm";

vi.mock("next/font/local", () => ({ default: () => ({ className: "", variable: "" }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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
});
