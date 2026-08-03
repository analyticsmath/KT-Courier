import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), "utf8");

describe("Phase 7.5 mutation-route security contracts", () => {
  it("protects quote and order creation with origin checks, sessions, roles, and rate limits", () => {
    const quote = source("app", "api", "pricing", "quotes", "route.ts");
    const order = source("app", "api", "orders", "route.ts");

    for (const route of [quote, order]) {
      expect(route).toContain("enforceSameOriginRequest(req)");
      expect(route).toContain("getCurrentUser()");
      expect(route).toContain("checkIpRateLimit");
      expect(route).toContain("forbidden()");
    }
  });

  it("protects pricing and dispatch administration with permission gates", () => {
    const pricing = source("app", "api", "admin", "pricing", "rules", "route.ts");
    const dispatch = source("app", "api", "admin", "orders", "[id]", "assign", "route.ts");

    expect(pricing).toContain("requireAdminApiPermission(PERMISSIONS.PRICING_MANAGE");
    expect(pricing).toContain("enforceSameOriginRequest(req)");
    expect(dispatch).toContain("requireAdminApiPermission(PERMISSIONS.DISPATCH_ASSIGN");
    expect(dispatch).toContain("enforceSameOriginRequest(req)");
  });
});
