import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { UserRole, UserStatus } from "@prisma/client";
import { proxy, sanitizeReturnUrl } from "../../proxy";
import { getStoreForUser, resolveStoreContext } from "../../lib/auth/store-context";
import { isUserStatusAllowedForSession } from "../../lib/auth/session";
import { assertSeedExecutionAllowed, SeedSafetyError } from "../../lib/security/seed-safety";
import { getIntegrationRegistry } from "../../lib/security/integration-registry";
import { calculateRoute } from "../../lib/maps/routes.service";
import { InMemoryRateLimitStore } from "../../lib/security/distributed-rate-limit";
import { normalizeRouteFilePathToPublicPattern } from "../../lib/security/route-security/normalize-route";
import { verifyRouteSecurityManifest } from "../../scripts/verify-route-security-manifest.mjs";

describe("Phase 1B — Security & Governance Foundations", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("Workstream 2 & 3 — Route Security Manifest", () => {
    it("should normalize route file paths to clean public URL patterns", () => {
      expect(normalizeRouteFilePathToPublicPattern("app/(admin)/admin/reports/artifacts/route.ts")).toBe("/admin/reports/artifacts");
      expect(normalizeRouteFilePathToPublicPattern("app/(public)/coverage-areas/route.ts")).toBe("/coverage-areas");
      expect(normalizeRouteFilePathToPublicPattern("app/api/store/ads/campaigns/[campaignRef]/funding/route.ts")).toBe("/api/store/ads/campaigns/:campaignRef/funding");
      expect(normalizeRouteFilePathToPublicPattern("app/api/v1/[[...path]]/route.ts")).toBe("/api/v1/*");
    });

    it("should successfully verify all 587 route files and 680 exported HTTP methods", () => {
      const result = verifyRouteSecurityManifest();
      expect(result.routeFilesCount).toBe(587);
      expect(result.totalMethodsCount).toBe(680);
      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe("Workstream 5 — Next.js 16 Proxy Gating", () => {
    it("should sanitize return URLs to prevent open redirect vulnerabilities", () => {
      expect(sanitizeReturnUrl("/admin/dashboard")).toBe("/admin/dashboard");
      expect(sanitizeReturnUrl("https://evil.example.invalid/phish")).toBe("/");
      expect(sanitizeReturnUrl("//evil.example.invalid")).toBe("/");
      expect(sanitizeReturnUrl("/\\evil.example.invalid")).toBe("/");
      expect(sanitizeReturnUrl(null)).toBe("/");
    });

    it("should redirect unauthenticated requests on protected browser surfaces", () => {
      const req = new NextRequest("http://localhost:3000/admin/settings");
      const res = proxy(req);
      expect(res.status).toBe(307); // NextResponse.redirect status
      expect(res.headers.get("location")).toContain("/login?returnUrl=%2Fadmin%2Fsettings");
    });

    it("should allow public browser routes without redirection", () => {
      const req = new NextRequest("http://localhost:3000/stores");
      const res = proxy(req);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });
  });

  describe("Workstream 7 — Store Ownership Resolution", () => {
    it("should resolve null for non-existent store owner user ID", async () => {
      const store = await getStoreForUser("non_existent_user_id");
      expect(store).toBeNull();
    });

    it("should return null for non-STORE role in resolveStoreContext", async () => {
      const result = await resolveStoreContext({
        id: "cust_1",
        email: "customer@example.com",
        name: "Customer",
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      });
      expect(result).toBeNull();
    });

    it("should reject suspended or deactivated user statuses for active sessions", () => {
      expect(isUserStatusAllowedForSession(UserStatus.ACTIVE)).toBe(true);
      expect(isUserStatusAllowedForSession(UserStatus.SUSPENDED)).toBe(false);
      expect(isUserStatusAllowedForSession(UserStatus.DISABLED)).toBe(false);
      expect(isUserStatusAllowedForSession(UserStatus.PENDING_VERIFICATION)).toBe(false);
    });
  });

  describe("Workstream 10 — Seed Execution Safety", () => {
    it("should refuse seed execution when NODE_ENV is production", () => {
      expect(() =>
        assertSeedExecutionAllowed({ nodeEnv: "production", classification: "development", allowDemoSeed: "true" })
      ).toThrowError(SeedSafetyError);
    });

    it("should refuse seed execution when database classification is production", () => {
      expect(() =>
        assertSeedExecutionAllowed({ nodeEnv: "development", classification: "production", allowDemoSeed: "true" })
      ).toThrowError(SeedSafetyError);
    });

    it("should refuse seed execution without explicit authorization", () => {
      expect(() =>
        assertSeedExecutionAllowed({ nodeEnv: "development", classification: "development", allowDemoSeed: false })
      ).toThrowError(SeedSafetyError);
    });

    it("should allow seed execution in development when explicitly authorized", () => {
      expect(() =>
        assertSeedExecutionAllowed({ nodeEnv: "development", classification: "development", allowDemoSeed: "true" })
      ).not.toThrow();
    });
  });

  describe("Workstream 11 — Integration Registry", () => {
    it("should expose all 15 platform integrations with safe status metadata", () => {
      const registry = getIntegrationRegistry();
      expect(registry.length).toBe(15);
      const ids = registry.map((r) => r.id);
      expect(ids).toContain("payfast");
      expect(ids).toContain("google-maps-browser");
      expect(ids).toContain("google-maps-server");
      expect(ids).toContain("resend-email");
      expect(ids).toContain("sms-notifications");
      expect(ids).toContain("whatsapp-notifications");
      expect(ids).toContain("push-notifications");
      expect(ids).toContain("payout-provider");

      registry.forEach((item) => {
        expect(item.safeStatusText).toBeDefined();
        // Secrets must never be exposed
        expect(JSON.stringify(item)).not.toContain("SECRET");
        expect(JSON.stringify(item)).not.toContain("KEY_VALUE");
      });
    });
  });

  describe("Workstream 12 — Google Maps Safety", () => {
    it("should reject deterministic mock route calculation in production", async () => {
      vi.stubEnv("E2E_ROUTE_PROVIDER", "deterministic");
      vi.stubEnv("NODE_ENV", "production");

      const res = await calculateRoute(-33.9, 18.4, -33.92, 18.42);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("MAPS_MOCK_REJECTED_IN_PRODUCTION");
      }
    });
  });

  describe("Workstream 13 — Rate Limiting Store", () => {
    it("should consume rate limit tokens and report backendUsed metadata", async () => {
      const store = new InMemoryRateLimitStore();
      const decision = await store.consume({
        key: "test:ip:127.0.0.1",
        policy: { max: 5, windowMs: 60000 },
      });
      expect(decision.accepted).toBe(true);
      expect(decision.backendUsed).toBe("MEMORY_TEST");
    });
  });
});
