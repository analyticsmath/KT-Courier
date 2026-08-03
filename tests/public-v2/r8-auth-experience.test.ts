import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { authMedia } from "@/lib/public-assets/auth-media";

const workspaceRoot = process.cwd();
const publicRoot = path.join(workspaceRoot, "public");
const readSource = (file: string) => readFileSync(path.join(workspaceRoot, file), "utf8");

const routes = [
  "login",
  "signup",
  "signup/select",
  "forgot-password",
  "reset-password",
  "verify-otp",
  "security-verification",
  "account-locked",
  "session-expired",
  "accept-invitation",
] as const;
const routeFiles = routes.map((route) => `app/(auth)/${route}/page.tsx`);
const routeSource = routeFiles.map(readSource).join("\n");

describe("R8 public authentication experience", () => {
  it("preserves exactly the verified auth route inventory with private metadata", () => {
    expect(routeFiles).toHaveLength(10);
    for (const file of routeFiles) {
      expect(existsSync(path.join(workspaceRoot, file))).toBe(true);
      const source = readSource(file);
      expect(source).toContain('robots: { index: false, follow: false }');
      expect(source).toMatch(/AuthRouteIntro|AuthStatusPage|Form/);
    }
    expect(routeSource).not.toMatch(/alternates:\s*\{[^}]*token/i);
    expect(sitemap().some((entry) => /\/(login|signup|forgot-password|reset-password|verify-otp|security-verification|account-locked|session-expired|accept-invitation)/.test(entry.url))).toBe(false);
  });

  it("keeps live forms on their canonical authorities and leaves unsupported routes non-actionable", () => {
    const login = readSource("app/(auth)/login/LoginForm.tsx");
    const signup = readSource("app/(auth)/signup/SignupForm.tsx");
    const forgot = readSource("app/(auth)/forgot-password/ForgotPasswordForm.tsx");
    const reset = readSource("app/(auth)/reset-password/ResetPasswordForm.tsx");
    const otp = readSource("app/(auth)/verify-otp/VerifyOtpForm.tsx");
    const invitation = readSource("app/(auth)/accept-invitation/page.tsx");
    const security = readSource("app/(auth)/security-verification/page.tsx");

    expect(login).toContain('fetch("/api/auth/login"');
    expect(signup).toContain('fetch("/api/auth/signup"');
    expect(forgot).toContain('fetch("/api/auth/forgot-password"');
    expect(reset).toContain('fetch("/api/auth/reset-password"');
    expect(otp).toContain('fetch("/api/auth/verify-otp"');
    expect(otp).toContain('fetch("/api/auth/resend-otp"');
    expect(invitation).not.toMatch(/fetch\(|<form|accept.*button/i);
    expect(security).not.toMatch(/fetch\(|<form|resend/i);
  });

  it("keeps access controls usable and avoids unsafe auth affordances", () => {
    const login = readSource("app/(auth)/login/LoginForm.tsx");
    const signup = readSource("app/(auth)/signup/SignupForm.tsx");
    const resetPage = readSource("app/(auth)/reset-password/page.tsx");
    const reset = readSource("app/(auth)/reset-password/ResetPasswordForm.tsx");
    const password = readSource("components/public-v2/auth/PasswordField.tsx");
    const otp = readSource("components/public-v2/auth/OtpField.tsx");

    expect(login).toContain('autoComplete="username"');
    expect(login).toContain('autoComplete="current-password"');
    expect(login).not.toMatch(/role selector|social|google|facebook|remember me|passkey/i);
    expect(signup).toContain('accountType: "CUSTOMER"');
    expect(signup).toContain('accountType: "STORE"');
    expect(password).toContain('type="button"');
    expect(password).toContain('aria-label={visibilityLabel}');
    expect(otp).toContain('autoComplete="one-time-code"');
    expect(otp).toContain('replace(/\\D/g, "").slice(0, 6)');
    expect(otp).not.toMatch(/onPaste|preventDefault/);
    expect(resetPage).not.toMatch(/<ResetPasswordForm\s+token=/);
    expect(reset).not.toMatch(/function ResetPasswordForm\(\{\s*token/);
    expect(reset).not.toMatch(/localStorage|sessionStorage/);
  });

  it("keeps messages generic, media local, and the visual system restrained", () => {
    const locked = readSource("app/(auth)/account-locked/page.tsx");
    const session = readSource("app/(auth)/session-expired/page.tsx");
    const css = readSource("components/public-v2/auth/auth-pages.module.css");
    const componentSource = readSource("components/public-v2/auth/AuthShellV2.tsx");

    expect(locked).not.toMatch(/billing|threshold|arrears|policy review|suspended/i);
    expect(session).toContain('href: "/login"');
    expect(css).toContain("grid-template-columns: repeat(9");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("forced-colors");
    expect(css).not.toMatch(/gradient|purple|ivory|glass/i);
    expect(componentSource).not.toContain('"use client"');
    expect(routeSource).not.toMatch(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)/i);

    for (const media of Object.values(authMedia)) {
      expect(media.src).toMatch(/^\/images\/kt-couriers\/provisional\//);
      expect(media.provisional).toBe(true);
      expect(media.provenanceStatus).toBe("PROVISIONAL_R2");
      expect(media.sourceLedgerReference).toMatch(/^#/);
      expect(media.visibleBrandReview).not.toBe("");
      expect(media.recognizablePersonReview).not.toBe("");
      expect(existsSync(path.join(publicRoot, media.src))).toBe(true);
    }
  });
});
