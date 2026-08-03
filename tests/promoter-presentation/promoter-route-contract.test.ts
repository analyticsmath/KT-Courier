import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const promoterPages = [
  "page.tsx",
  "links/page.tsx",
  "referrals/page.tsx",
  "referrals/[reference]/page.tsx",
  "earnings/page.tsx",
  "earnings/[reference]/page.tsx",
  "wallet/page.tsx",
  "withdrawals/page.tsx",
  "programs/page.tsx",
  "programs/[reference]/page.tsx",
  "assets/page.tsx",
  "performance/page.tsx",
  "compliance/page.tsx",
  "profile/page.tsx",
  "notifications/page.tsx",
  "support/page.tsx",
  "disputes/page.tsx",
  "disputes/[reference]/page.tsx",
] as const;

describe("R17 promoter route boundary", () => {
  it("retains every live promoter path and the nested protected shell", () => {
    const routeRoot = join(root, "app/(account)/promoter");
    for (const page of promoterPages) expect(existsSync(join(routeRoot, page))).toBe(true);
    const layout = readFileSync(join(routeRoot, "layout.tsx"), "utf8");
    expect(layout).toMatch(/requireRole\(UserRole\.PROMOTER\)/);
    expect(layout).toMatch(/context="PROMOTER"/);
    expect(layout).toMatch(/EditorialOperationsShell/);
  });

  it("removes the client JSON viewer from R17 page bodies", () => {
    const routeRoot = join(root, "app/(account)/promoter");
    for (const page of promoterPages) {
      const source = readFileSync(join(routeRoot, page), "utf8");
      expect(source).not.toMatch(/PromoterSurface|JSON\.stringify|fetch\(/);
    }
  });

  it("keeps referral, earning, wallet, and withdrawal data behind a server route gate", () => {
    const routeRoot = join(root, "app/(account)/promoter");
    for (const page of ["page.tsx", "links/page.tsx", "referrals/page.tsx", "earnings/page.tsx", "wallet/page.tsx", "withdrawals/page.tsx", "programs/page.tsx", "assets/page.tsx", "profile/page.tsx", "compliance/page.tsx", "disputes/page.tsx"] as const) {
      expect(readFileSync(join(routeRoot, page), "utf8")).toContain("getPromoterPresentationContext");
    }
  });

  it("does not select prohibited promoter-facing fields in the presentation projection", () => {
    const source = readFileSync(join(root, "lib/promoter-presentation/promoter-data.ts"), "utf8");
    for (const field of ["customerUserId", "businessAccountId", "paymentId", "safeEvidence", "codeHmac", "codeFingerprint", "sessionFingerprint", "networkRiskFingerprint", "commissionPlanVersionId", "payoutDestinationId"]) expect(source).not.toContain(field);
  });
});
