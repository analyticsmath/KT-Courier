import { describe, it, expect } from "vitest";
import {
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
});
