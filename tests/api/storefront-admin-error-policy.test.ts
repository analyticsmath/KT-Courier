import { expect, test, vi } from "vitest";
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: vi.fn() }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkIpRateLimit: vi.fn(), RATE_LIMITS: {} }));
import { storefrontAdminError } from "@/lib/storefront/storefront-admin-api";
import { StorefrontReconciliationError } from "@/lib/services/storefront-reconciliation.service";

test("expected canonical source refusal is a private conflict, not a transient outage", async () => {
  const response = storefrontAdminError(new StorefrontReconciliationError("CANONICAL_REBUILD_UNAVAILABLE", "PRIVATE_SOURCE_FACT"));
  expect(response.status).toBe(409);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toEqual({ code: "CANONICAL_REBUILD_UNAVAILABLE", error: "This case requires correction through its canonical source event. A manual rebuild is unavailable." });
});
test("resolved history conflicts while unexpected errors retain safe outage semantics", async () => {
  expect(storefrontAdminError(new StorefrontReconciliationError("PROJECTION_CASE_RESOLVED", "PRIVATE_SOURCE_FACT")).status).toBe(409);
  const unknown = storefrontAdminError(new Error("PRIVATE_PROVIDER_SECRET"));
  expect(unknown.status).toBe(503);
  expect(JSON.stringify(await unknown.json())).not.toContain("PRIVATE_PROVIDER_SECRET");
});
