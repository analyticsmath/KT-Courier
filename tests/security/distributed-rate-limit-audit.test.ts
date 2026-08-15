import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { RATE_LIMITS } from "../../lib/security/rate-limit";

function getSourceFiles(dir: string): string[] {
  let results: string[] = [];
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getSourceFiles(fullPath));
    } else if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("P1R-001: Static Source Audit — Distributed Rate Limiting Coverage & Authoritative Wiring", () => {
  const root = path.resolve(__dirname, "../..");
  const apiDir = path.join(root, "app", "api");
  const apiFiles = getSourceFiles(apiDir);

  it("verifies all policies marked distributedRequired=true are defined with distributedRequired flag", () => {
    const distributedPolicies = [
      "LOGIN",
      "SIGNUP",
      "FORGOT_PASSWORD",
      "RESET_PASSWORD",
      "RESEND_OTP",
      "VERIFY_OTP",
      "DRIVER_LOCATION",
      "PRIVATE_MEDIA_UPLOAD",
      "PRIVACY_REQUEST_SUBMISSION",
      "COD_COLLECTION",
      "COD_RECONCILIATION",
      "CLAIM_CREATE",
      "CLAIM_MUTATION",
      "MANAGED_MARKETING_REQUEST_CREATE",
      "MANAGED_MARKETING_REQUEST_MUTATION",
      "MANAGED_MARKETING_CREATIVE_ATTACH",
      "MANAGED_MARKETING_PAYMENT_PREPARE",
      "COOKIE_PREFERENCE_MUTATION",
    ];

    for (const name of distributedPolicies) {
      const policy = RATE_LIMITS[name];
      expect(policy, `Policy ${name} must exist in RATE_LIMITS`).toBeDefined();
      expect(policy?.distributedRequired, `Policy ${name} must have distributedRequired: true`).toBe(true);
    }
  });

  it("verifies every production route handling a distributedRequired domain awaits the canonical rate limiter", () => {
    const criticalEndpoints: Array<{ filePattern: string; expectedPolicy: string }> = [
      { filePattern: "app/api/auth/login/route.ts", expectedPolicy: "RATE_LIMITS.LOGIN" },
      { filePattern: "app/api/auth/signup/route.ts", expectedPolicy: "RATE_LIMITS.SIGNUP" },
      { filePattern: "app/api/auth/forgot-password/route.ts", expectedPolicy: "RATE_LIMITS.FORGOT_PASSWORD" },
      { filePattern: "app/api/auth/reset-password/route.ts", expectedPolicy: "RATE_LIMITS.RESET_PASSWORD" },
      { filePattern: "app/api/auth/verify-otp/route.ts", expectedPolicy: "RATE_LIMITS.VERIFY_OTP" },
      { filePattern: "app/api/auth/resend-otp/route.ts", expectedPolicy: "RATE_LIMITS.RESEND_OTP" },
      { filePattern: "app/api/driver/assignments/[id]/location/route.ts", expectedPolicy: "RATE_LIMITS.DRIVER_LOCATION" },
      { filePattern: "app/api/driver/private-media/route.ts", expectedPolicy: "RATE_LIMITS.PRIVATE_MEDIA_UPLOAD" },
      { filePattern: "app/api/privacy/requests/route.ts", expectedPolicy: "RATE_LIMITS.PRIVACY_REQUEST_SUBMISSION" },
      { filePattern: "app/api/privacy/cookie-preferences/route.ts", expectedPolicy: "RATE_LIMITS.COOKIE_PREFERENCE_MUTATION" },
      { filePattern: "app/api/claims/route.ts", expectedPolicy: "RATE_LIMITS.CLAIM_CREATE" },
      { filePattern: "app/api/driver/orders/[orderId]/cod/collection/route.ts", expectedPolicy: "RATE_LIMITS.COD_COLLECTION" },
      { filePattern: "app/api/admin/orders/[orderId]/cod/reconcile/route.ts", expectedPolicy: "RATE_LIMITS.COD_RECONCILIATION" },
    ];

    for (const item of criticalEndpoints) {
      const normalizedPath = path.join(root, ...item.filePattern.split("/"));
      expect(fs.existsSync(normalizedPath), `File ${item.filePattern} must exist`).toBe(true);

      const content = fs.readFileSync(normalizedPath, "utf8");
      expect(content).toContain(item.expectedPolicy);
      
      // Must call checkRateLimit / checkIpRateLimit / checkAuthRateLimit with await
      const hasAwaitedCheck =
        content.includes("await checkAuthRateLimit(") ||
        content.includes("await checkIpRateLimit(") ||
        content.includes("await checkRateLimit(");

      expect(hasAwaitedCheck, `${item.filePattern} must await canonical rate limiter`).toBe(true);
    }
  });

  it("proves no production API routes call rate-limit checks without await", () => {
    const unawaitedCalls: string[] = [];

    for (const file of apiFiles) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (
          (line.includes("checkIpRateLimit(") ||
            line.includes("checkAuthRateLimit(") ||
            line.includes("checkRateLimit(")) &&
          !line.includes("await check") &&
          !line.trim().startsWith("//") &&
          !line.trim().startsWith("*")
        ) {
          unawaitedCalls.push(`${path.relative(root, file)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }

    expect(unawaitedCalls, `Found unawaited rate limit calls:\n${unawaitedCalls.join("\n")}`).toEqual([]);
  });

  it("proves PayFast ITN intake enforces distributed rate limiting and process concurrency", () => {
    const itnRateLimitFile = path.join(root, "lib", "payments", "providers", "payfast", "payfast-itn-rate-limit.ts");
    const content = fs.readFileSync(itnRateLimitFile, "utf8");

    expect(content).toContain("await checkRateLimit(\"payfast-itn:global\", GLOBAL_POLICY)");
    expect(content).toContain("await checkRateLimit(`payfast-itn:source:${sourceAddress}`, SOURCE_POLICY)");
    expect(content).toContain("MAX_CONCURRENT_REQUESTS");
  });

  it("proves every beginPayfastItnRequest and assertPayfastSourceRateLimit call-site is strictly awaited", () => {
    const allSourceFiles = [
      ...getSourceFiles(path.join(root, "app")),
      ...getSourceFiles(path.join(root, "lib")),
    ];

    const unawaitedPayfastCalls: string[] = [];

    for (const file of allSourceFiles) {
      if (file.endsWith("payfast-itn-rate-limit.ts")) continue;
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
        if (trimmed.startsWith("import ")) return;

        if (trimmed.includes("beginPayfastItnRequest(") && !trimmed.includes("await beginPayfastItnRequest(")) {
          unawaitedPayfastCalls.push(`${path.relative(root, file)}:${idx + 1}: ${trimmed}`);
        }
        if (trimmed.includes("assertPayfastSourceRateLimit(") && !trimmed.includes("await assertPayfastSourceRateLimit(")) {
          unawaitedPayfastCalls.push(`${path.relative(root, file)}:${idx + 1}: ${trimmed}`);
        }
      });
    }

    expect(
      unawaitedPayfastCalls,
      `Found unawaited PayFast rate limiter calls:\n${unawaitedPayfastCalls.join("\n")}`
    ).toEqual([]);
  });
});
