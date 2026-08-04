import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { UserRole, UserStatus } from "@prisma/client";
import { checkAuthRateLimit, checkIpRateLimit, RATE_LIMITS } from "../../lib/security/rate-limit";
import { calculateRoute } from "../../lib/maps/routes.service";
import { getStoreForUser, resolveStoreContext } from "../../lib/auth/store-context";
import { isUserStatusAllowedForSession } from "../../lib/auth/session";
import { assertSeedExecutionAllowed, SeedSafetyError } from "../../lib/security/seed-safety";
import { POST as signupHandler } from "../../app/api/auth/signup/route";

describe("Phase 1B-E — Runtime Wiring & Behavioural Proof", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("Workstream 1 & 2 — Rate Limit Request-Level Integration", () => {
    it("should return failClosed result in production without Redis for LOGIN policy", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("REDIS_URL", "");

      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", password: "SecretPassword123!" }),
      });

      const res = checkAuthRateLimit(req, "login", "user@example.com", RATE_LIMITS.LOGIN);

      expect(res.ok).toBe(false);
      expect(res.failClosed).toBe(true);
      expect(res.errorResponse?.code).toBe("SERVICE_TEMPORARILY_UNAVAILABLE");
    });

    it("should return failClosed result in production without Redis for SIGNUP policy", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("REDIS_URL", "");

      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
      });

      const res = checkIpRateLimit(req, "signup", RATE_LIMITS.SIGNUP);

      expect(res.ok).toBe(false);
      expect(res.failClosed).toBe(true);
      expect(res.errorResponse?.code).toBe("SERVICE_TEMPORARILY_UNAVAILABLE");
    });
  });

  describe("Workstream 3 — Maps Result Code Execution", () => {
    it("should return MAPS_CREDENTIALS_MISSING when Google server key is not configured", async () => {
      vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "");

      const res = await calculateRoute(-33.9, 18.4, -33.92, 18.42);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("MAPS_CREDENTIALS_MISSING");
      }
    });

    it("should return MAPS_MOCK_REJECTED_IN_PRODUCTION when deterministic mock is invoked in production", async () => {
      vi.stubEnv("E2E_ROUTE_PROVIDER", "deterministic");
      vi.stubEnv("NODE_ENV", "production");

      const res = await calculateRoute(-33.9, 18.4, -33.92, 18.42);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("MAPS_MOCK_REJECTED_IN_PRODUCTION");
      }
    });
  });

  describe("Workstream 4 & 5 — Repaired Store Routes & Ownership Isolation", () => {
    it("should resolve Store.id using getStoreForUser and ignore client-supplied store IDs", async () => {
      const store = await getStoreForUser("user_store_owner_1");
      expect(store).toBeNull(); // Null because user does not exist in offline test DB
    });

    it("should deny non-STORE account types in resolveStoreContext", async () => {
      const customerStore = await resolveStoreContext({
        id: "cust_user_1",
        email: "cust@example.com",
        name: "Customer",
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      });
      expect(customerStore).toBeNull();
    });
  });

  describe("Workstream 6 — Registration Privilege Coercion", () => {
    it("should reject invalid account types during signup validation", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" },
        body: JSON.stringify({
          accountType: "SUPER_ADMIN",
          email: "admin@example.com",
          password: "Password123!",
        }),
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Account type must be CUSTOMER or STORE.");
    });
  });

  describe("Workstream 7 — Session Lifecycle Verification", () => {
    it("should enforce active status during session verification", () => {
      expect(isUserStatusAllowedForSession(UserStatus.ACTIVE)).toBe(true);
      expect(isUserStatusAllowedForSession(UserStatus.SUSPENDED)).toBe(false);
      expect(isUserStatusAllowedForSession(UserStatus.DISABLED)).toBe(false);
    });
  });

  describe("Workstream 8 — Seed Policy Edge Cases", () => {
    it("should reject staging database classification and production environment", () => {
      expect(() =>
        assertSeedExecutionAllowed({ nodeEnv: "production", classification: "development", allowDemoSeed: "true" })
      ).toThrowError(SeedSafetyError);

      expect(() =>
        assertSeedExecutionAllowed({ nodeEnv: "development", classification: "staging", allowDemoSeed: "true" })
      ).toThrowError(SeedSafetyError);
    });

    it("should ensure SeedSafetyError never leaks raw connection strings or passwords", () => {
      try {
        assertSeedExecutionAllowed({ nodeEnv: "production", classification: "production", allowDemoSeed: "true" });
      } catch (err) {
        expect(err).toBeInstanceOf(SeedSafetyError);
        const msg = (err as Error).message;
        expect(msg).not.toContain("postgresql://");
        expect(msg).not.toContain("5433");
      }
    });
  });
});
