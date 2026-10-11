import { describe, expect, it } from "vitest";
import { passwordResetUrl } from "@/lib/auth/password-reset-url";
describe("server-authoritative password reset email links", () => {
  it("produces an absolute link when the embedded public URL is empty", () => {
    expect(passwordResetUrl("synthetic-token", { NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "" })).toBe("https://ktcouriers.com/reset-password?token=synthetic-token");
  });
  it("uses configured runtime origin and preserves exact token bytes", () => {
    const url = new URL(passwordResetUrl("synthetic+token&value", { APP_URL: "http://localhost:3210", NEXT_PUBLIC_APP_URL: "" }));
    expect(url.origin).toBe("http://localhost:3210"); expect(url.pathname).toBe("/reset-password"); expect(url.searchParams.get("token")).toBe("synthetic+token&value");
  });
  it.each(["http://remote.example.test", "https://user:secret@example.test", "/relative"])("rejects invalid or credential-bearing configured origin %s", APP_URL => {
    expect(() => passwordResetUrl("synthetic-token", { APP_URL })).toThrow();
  });
});
