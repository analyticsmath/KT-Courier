/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

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
});
