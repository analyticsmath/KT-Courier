import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Phase 27 source audits", () => {
  it("removes independent production email providers and adapts auth at the Phase 27 boundary", () => {
    const emailAdapter = readFileSync(join(process.cwd(), "lib", "email", "email-service.ts"), "utf8");
    expect(emailAdapter).toContain("queueLegacyEmailIntent");
    expect(emailAdapter).not.toContain("Resend");
    for (const file of ["app/api/auth/signup/route.ts", "app/api/auth/forgot-password/route.ts", "app/api/auth/reset-password/route.ts", "lib/services/delivery-otp.service.ts"]) expect(readFileSync(join(process.cwd(), file), "utf8")).toContain("queueSecurityNotification");
    const resendRoute = readFileSync(join(process.cwd(), "app/api/auth/resend-otp/route.ts"), "utf8");
    expect(resendRoute).toContain("issuePendingVerificationOtp");
    // The canonical notifications module is the only producer of resends;
    // a route must never send directly, or bypass the transactional outbox.
    const resendIssuer = readFileSync(join(process.cwd(), "lib/notifications/pending-verification-otp.ts"), "utf8");
    expect(resendIssuer).toContain("queueSecurityNotification");
    expect(resendIssuer).toContain("$transaction");
  });

  it("keeps secrets, raw push endpoints and arbitrary sending outside DTOs and logs", () => {
    const security = readFileSync(join(process.cwd(), "lib", "notifications", "security-delivery.ts"), "utf8");
    const endpoint = readFileSync(join(process.cwd(), "app", "api", "notifications", "endpoints", "route.ts"), "utf8");
    expect(security).toContain("encryptedPayload");
    expect(security).toContain("safePayload");
    expect(endpoint).not.toContain("endpoint: item.endpoint");
    const diagnostic = readFileSync(join(process.cwd(), "app", "api", "admin", "emails", "test", "route.ts"), "utf8");
    expect(diagnostic).toContain("requireAdminApiPermission(PERMISSIONS.EMAILS_TEST");
    expect(diagnostic).toContain("enforceSameOriginRequest");
    expect(diagnostic).toContain("RATE_LIMITS.ADMIN_TEST_EMAIL");
    expect(diagnostic).toContain("sendAdminEmailDiagnostic");
    expect(diagnostic).not.toMatch(/new Resend|provider\.send/);
    const diagnosticService = readFileSync(join(process.cwd(), "lib", "notifications", "admin-email-diagnostic.ts"), "utf8");
    expect(diagnosticService).toContain('status: "ACTIVE", emailVerifiedAt: { not: null }');
    expect(diagnosticService).toContain("ADMIN_EMAIL_DIAGNOSTIC_REQUESTED");
    expect(diagnosticService).toContain("delivered: false");
  });
});
