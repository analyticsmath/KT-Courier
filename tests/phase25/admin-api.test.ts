import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const routeGroups = {
  programs: ["route.ts", "[reference]/route.ts", "[reference]/submit/route.ts", "[reference]/approve/route.ts", "[reference]/reject/route.ts", "[reference]/activate/route.ts", "[reference]/pause/route.ts", "[reference]/end/route.ts"].map((file) => join("app/api/admin/promoter-programs", file)),
  promoters: ["route.ts", "[reference]/route.ts", "[reference]/approve/route.ts", "[reference]/request-changes/route.ts", "[reference]/activate/route.ts", "[reference]/suspend/route.ts", "[reference]/terminate/route.ts"].map((file) => join("app/api/admin/promoters", file)),
  agreements: ["route.ts", "[reference]/route.ts", "[reference]/submit/route.ts", "[reference]/approve/route.ts", "[reference]/activate/route.ts", "[reference]/retire/route.ts"].map((file) => join("app/api/admin/promoter-agreements", file)),
  assets: ["route.ts", "[reference]/route.ts", "[reference]/submit/route.ts", "[reference]/approve/route.ts", "[reference]/reject/route.ts", "[reference]/activate/route.ts", "[reference]/retire/route.ts"].map((file) => join("app/api/admin/promoter-assets", file)),
  fraud: ["route.ts", "[reference]/route.ts", "[reference]/start-review/route.ts", "[reference]/request-evidence/route.ts", "[reference]/clear/route.ts", "[reference]/confirm/route.ts", "[reference]/rescan/route.ts"].map((file) => join("app/api/admin/promoter-fraud", file)),
  reconciliation: ["route.ts", "[reference]/route.ts", "[reference]/rescan/route.ts", "[reference]/retry-attribution/route.ts", "[reference]/retry-qualification/route.ts", "[reference]/retry-accrual/route.ts", "[reference]/retry-release/route.ts", "[reference]/retry-reversal/route.ts"].map((file) => join("app/api/admin/promoter-reconciliation", file)),
  disputes: ["route.ts", "[reference]/route.ts", "[reference]/start-review/route.ts", "[reference]/respond/route.ts", "[reference]/close/route.ts"].map((file) => join("app/api/admin/promoter-disputes", file)),
};
const allRoutes = Object.values(routeGroups).flat();
const source = allRoutes.map((file) => readFileSync(join(root, file), "utf8")).join("\n") + readFileSync(join(root, "lib/promoters/admin-api-policy.ts"), "utf8") + readFileSync(join(root, "lib/promoters/admin-lifecycle-route.ts"), "utf8") + readFileSync(join(root, "lib/promoters/reconciliation-route.ts"), "utf8") + readFileSync(join(root, "lib/promoters/dispute-admin-route.ts"), "utf8");

describe("Phase 25 admin API composition", () => {
  it("contains every required lifecycle and evidence route", () => expect(allRoutes.every((file) => existsSync(join(root, file)))).toBe(true));
  it("uses admin permission and same-origin/rate-limit guards for mutations", () => {
    expect(source).toMatch(/requirePromoterAdmin/);
    expect(source).toMatch(/enforceSameOriginRequest/);
    expect(source).toMatch(/checkIpRateLimit/);
  });
  it("routes lifecycle actions to canonical services", () => {
    expect(source).toMatch(/PromoterLifecycleService/);
    expect(source).toMatch(/promoter-marketing-asset|promoter-agreement/);
    expect(source).toMatch(/promoter-fraud|promoter-reconciliation|promoter-dispute/);
  });
  it("has no generic reconciliation resolve or inline financial editor", () => expect(source).not.toMatch(/forceResolve|markResolved|manualAdjustment|manualConvergence|directBalanceEdit|wallet\.update/));
  it("preserves replay and strict input validation", () => { expect(source).toMatch(/operationId/); expect(source).toMatch(/parsePromoterCommand/); expect(source).toMatch(/\.strict\(\)/); });
  it("requires trusted, disclosure-bound, safe marketing assets", () => { expect(source).toMatch(/trustedAssetReference/); expect(source).toMatch(/requiredDisclosure/); expect(source).toMatch(/rejectPromoterMarketingAsset/); });
});
