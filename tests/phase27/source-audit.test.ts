import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Phase 27 source audits", () => {
  it("removes independent production email providers and adapts auth at the Phase 27 boundary", () => {
    const emailAdapter = readFileSync(join(process.cwd(), "lib", "email", "email-service.ts"), "utf8");
    expect(emailAdapter).toContain("queueLegacyEmailIntent");
    expect(emailAdapter).not.toContain("Resend");
    for (const file of ["app/api/auth/signup/route.ts", "app/api/auth/resend-otp/route.ts", "app/api/auth/forgot-password/route.ts", "app/api/auth/reset-password/route.ts", "lib/services/delivery-otp.service.ts"]) expect(readFileSync(join(process.cwd(), file), "utf8")).toContain("queueSecurityNotification");
  });

  it("keeps secrets, raw push endpoints and arbitrary sending outside DTOs and logs", () => {
    const security = readFileSync(join(process.cwd(), "lib", "notifications", "security-delivery.ts"), "utf8");
    const endpoint = readFileSync(join(process.cwd(), "app", "api", "notifications", "endpoints", "route.ts"), "utf8");
    expect(security).toContain("encryptedPayload");
    expect(security).toContain("safePayload");
    expect(endpoint).not.toContain("endpoint: item.endpoint");
    expect(readFileSync(join(process.cwd(), "app", "api", "admin", "emails", "test", "route.ts"), "utf8")).toContain("Manual sending is not available");
  });
});
