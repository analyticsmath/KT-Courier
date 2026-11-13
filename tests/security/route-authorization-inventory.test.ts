/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

function walkApiRoutes(dir: string): string[] {
  let results: string[] = [];
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(walkApiRoutes(full));
    } else if (entry === "route.ts" || entry === "route.js") {
      results.push(full);
    }
  }
  return results;
}

describe("P1R-009: Route and Server Action Authorization Inventory Drift Prevention", () => {
  const root = path.resolve(__dirname, "../..");
  const artifactPath = path.join(root, "artifacts", "route-action-authorization-inventory.json");
  const apiDir = path.join(root, "app", "api");

  it("proves the authorization inventory artifact exists and conforms to required schema", () => {
    expect(fs.existsSync(artifactPath), "Artifact route-action-authorization-inventory.json must exist").toBe(true);
    const content = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    expect(content.summary).toBeDefined();
    expect(typeof content.summary.totalRoutes).toBe("number");
    expect(content.summary.totalRoutes).toBeGreaterThan(0);
    expect(typeof content.summary.publicRoutes).toBe("number");
    expect(typeof content.summary.authenticatedRoutes).toBe("number");
    expect(Array.isArray(content.routes)).toBe(true);
    expect(content.routes.length).toBe(content.summary.totalRoutes);
  });

  it("verifies 100% coverage: every physical route in app/api/** is indexed in the artifact", () => {
    const physicalRoutes = walkApiRoutes(apiDir).map((p) =>
      path.relative(root, p).replace(/\\/g, "/")
    );
    const content = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const inventoryPaths = new Set(content.routes.map((r: any) => r.routePath));

    const missingRoutes = physicalRoutes.filter((p) => !inventoryPaths.has(p));
    expect(missingRoutes, `Unindexed routes found in app/api:\n${missingRoutes.join("\n")}`).toEqual([]);
    expect(physicalRoutes.length).toBe(content.routes.length);
  });

  it("verifies each route entry has required metadata fields", () => {
    const content = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    for (const item of content.routes) {
      expect(item.routePath, `routePath missing in ${JSON.stringify(item)}`).toBeDefined();
      expect(Array.isArray(item.httpMethods), `httpMethods missing in ${item.routePath}`).toBe(true);
      expect(item.httpMethods.length).toBeGreaterThan(0);
      expect(typeof item.authorizationMechanism, `authorizationMechanism missing in ${item.routePath}`).toBe("string");
      expect(Array.isArray(item.requiredRoles), `requiredRoles missing in ${item.routePath}`).toBe(true);
      expect(typeof item.rateLimitingApplied, `rateLimitingApplied missing in ${item.routePath}`).toBe("boolean");
      expect(typeof item.idempotencyEnforced, `idempotencyEnforced missing in ${item.routePath}`).toBe("boolean");
      expect(typeof item.bolaOwnershipValidated, `bolaOwnershipValidated missing in ${item.routePath}`).toBe("boolean");
      expect(typeof item.remediationStatus, `remediationStatus missing in ${item.routePath}`).toBe("string");
    }
  });

  it("records the permission each admin route actually enforces (no empty requiredPermissions)", () => {
    const content = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const byPath = new Map<string, any>(content.routes.map((r: any) => [r.routePath, r]));
    const offenders: string[] = [];
    for (const file of walkApiRoutes(apiDir)) {
      const rel = path.relative(root, file).replace(/\\/g, "/");
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(/requireAdminApiPermission\(\s*PERMISSIONS\.([A-Z0-9_]+)/g)) {
        const expected = (PERMISSIONS as Record<string, string>)[match[1]];
        const entry = byPath.get(rel);
        if (!expected || !entry || !entry.requiredPermissions.includes(expected)) {
          offenders.push(`${rel} -> ${match[1]}`);
        }
      }
    }
    expect(offenders, `Routes whose enforced permission is missing from the inventory:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("locks the isolated live Paystack verification API to superadmin with rate limits and ownership", () => {
    const content = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const entry = content.routes.find((row: { routePath: string }) =>
      row.routePath === "app/api/admin/payment-providers/live-verification/route.ts");
    expect(entry).toMatchObject({
      httpMethods: ["GET", "POST"],
      authorizationMechanism: "SUPER_ADMIN_SESSION",
      requiredRoles: ["SUPER_ADMIN"],
      rateLimitingApplied: true,
      idempotencyEnforced: true,
      bolaOwnershipValidated: true,
      remediationStatus: "COMPLIANT",
    });
  });

  it("records the exact SUPER_ADMIN role for privileged commerce and password recovery", () => {
    const report = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    for (const routePath of ["app/api/admin/super-admin/commerce/route.ts", "app/api/admin/super-admin/password-reset/route.ts"]) {
      const entry = report.routes.find((r: { routePath: string }) => r.routePath === routePath);
      expect(entry, routePath).toBeDefined();
      expect(entry.httpMethods).toEqual(["POST"]);
      expect(entry.authorizationMechanism).toBe("SUPER_ADMIN_SESSION");
      expect(entry.requiredRoles).toEqual(["SUPER_ADMIN"]);
      expect(entry.rateLimitingApplied).toBe(true);
    }
  });

  it("tracks new customer-review and finance/driver dual-permission routes accurately", () => {
    const content = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const get = (routePath: string) =>
      content.routes.find((row: { routePath: string }) => row.routePath === routePath);
    expect(get("app/api/account/driver-reviews/route.ts")).toMatchObject({
      httpMethods: ["GET", "POST"], requiredRoles: ["CUSTOMER"],
      bolaOwnershipValidated: true, rateLimitingApplied: true,
    });
    expect(get("app/api/admin/drivers/[id]/cash-limit/route.ts")).toMatchObject({
      httpMethods: ["PATCH"], requiredRoles: ["ADMIN", "SUPER_ADMIN"],
      requiredPermissions: [PERMISSIONS.DRIVERS_UPDATE, "cod_operations.manage"],
    });
    expect(get("app/api/admin/drivers/[id]/engagement/route.ts")).toMatchObject({
      httpMethods: ["PATCH"], requiredRoles: ["ADMIN", "SUPER_ADMIN"],
      requiredPermissions: [PERMISSIONS.DRIVERS_UPDATE, PERMISSIONS.DRIVERS_STATUS_MANAGE],
    });
    expect(get("app/api/admin/stores/[id]/checkout-certification/route.ts")).toMatchObject({
      httpMethods: ["GET", "POST", "PATCH"],
      requiredRoles: ["ADMIN", "SUPER_ADMIN"],
      requiredPermissions: [PERMISSIONS.STORES_APPROVE, PERMISSIONS.ORDERS_READ, PERMISSIONS.STORES_READ],
    });
  });

  it("limits ordinary referrals to authenticated customer and store owners", () => {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const referral = artifact.routes.find((row: { routePath: string }) =>
      row.routePath === "app/api/account/referrals/route.ts");
    expect(referral).toMatchObject({
      httpMethods: ["GET", "POST"],
      requiredRoles: ["CUSTOMER", "STORE"],
      rateLimitingApplied: true,
      bolaOwnershipValidated: true,
    });
  });

  it("records dual finance/customer permissions for the read-only referral evidence API", () => {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const route = artifact.routes.find((entry: { routePath: string }) =>
      entry.routePath === "app/api/admin/referrals/[id]/eligibility/route.ts");
    expect(route).toMatchObject({
      httpMethods: ["GET"],
      requiredRoles: ["ADMIN", "SUPER_ADMIN"],
      requiredPermissions: expect.arrayContaining(["customers.read", "finance.read"]),
      rateLimitingApplied: true,
    });
  });

  it("keeps the dispatch recovery route inventory truthful (method, role, permission, protections, idempotency)", () => {
    const content = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const entry = content.routes.find((r: any) => r.routePath === "app/api/admin/dispatch/recover/route.ts");
    expect(entry).toBeDefined();
    expect(entry.httpMethods).toEqual(["POST"]);
    expect(entry.authorizationMechanism).toBe("ADMIN_SESSION_PERMISSION");
    expect(entry.requiredRoles).toEqual(["ADMIN", "SUPER_ADMIN"]);
    expect(entry.requiredPermissions).toEqual([PERMISSIONS.DISPATCH_MANAGE]);
    expect(entry.originProtection).toBe("ENFORCED_IN_ROUTE");
    expect(entry.rateLimitingApplied).toBe(true);

    // idempotencyEnforced may only be true while the route really requires the key.
    const source = fs.readFileSync(path.join(root, entry.routePath), "utf8");
    const keyDeclaredOptional =
      /\bidempotencyKey\s*\?\s*:/.test(source) ||
      /\bidempotencyKey\s*:\s*z\.[^\n]*\.(optional|nullish)\(\)/.test(source);
    expect(source).toMatch(/idempotencyKey\s*:\s*z/);
    expect(keyDeclaredOptional).toBe(false);
    expect(entry.idempotencyEnforced).toBe(true);
  });
});
