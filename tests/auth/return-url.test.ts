import { describe, it, expect } from "vitest";
import {
  signupVerificationReturnUrl,
  safeAuthReturnUrl,
  verificationReturnUrl,
} from "@/lib/auth/return-url";
describe("authentication continuation", () => {
  it.each([
    "/quote?reference=cquote123",
    "/business-invitation?token=abc",
    "/store/orders",
    "/account",
  ])("preserves safe destination %s", (path) => {
    expect(safeAuthReturnUrl(path)).toBe(path);
  });
  it.each([
    "https://evil.invalid",
    "//evil.invalid",
    "/\\evil.invalid",
    "/login\nlocation:evil",
    "/%2f%2fevil.invalid",
    "/%5cevil.invalid",
    "javascript:alert(1)",
  ])("rejects unsafe destination %s", (path) => {
    expect(safeAuthReturnUrl(path)).toBeUndefined();
  });
  it("preserves the quote or invitation through email verification", () => {
    const destination = "/business-invitation?token=a".repeat(2);
    const url = new URL(
      verificationReturnUrl("worker@example.com", destination),
      "https://example.test",
    );
    expect(url.pathname).toBe("/verify-otp");
    expect(url.searchParams.get("returnUrl")).toBe(destination);
    expect(url.searchParams.get("email")).toBe("worker@example.com");
  });

  it("continues a new driver into protected onboarding after email verification", () => {
    const url = new URL(
      signupVerificationReturnUrl("driver@example.com", "driver"),
      "https://example.test",
    );
    expect(url.pathname).toBe("/verify-otp");
    expect(url.searchParams.get("returnUrl")).toBe("/driver/onboarding");
  });

  it("preserves an explicit safe continuation for driver signup", () => {
    const url = new URL(
      signupVerificationReturnUrl(
        "driver@example.com",
        "driver",
        "/driver/profile?tab=documents",
        true,
      ),
      "https://example.test",
    );
    expect(url.searchParams.get("returnUrl")).toBe(
      "/driver/profile?tab=documents",
    );
    expect(url.searchParams.get("delivery")).toBe("pending");
  });

  it("uses the protected onboarding default when a driver continuation is unsafe", () => {
    const url = new URL(
      signupVerificationReturnUrl(
        "driver@example.com",
        "driver",
        "https://evil.invalid",
      ),
      "https://example.test",
    );
    expect(url.searchParams.get("returnUrl")).toBe("/driver/onboarding");
  });
});
