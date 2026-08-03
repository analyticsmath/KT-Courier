import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

export const publicRoutes = [
  "app/api/careers/openings/route.ts",
  "app/api/careers/openings/[reference]/route.ts",
];
export const applicantRoutes = [
  "app/api/applicant/profile/route.ts", "app/api/applicant/applications/route.ts", "app/api/applicant/applications/[reference]/route.ts",
  "app/api/applicant/applications/[reference]/answers/route.ts", "app/api/applicant/applications/[reference]/documents/route.ts",
  "app/api/applicant/applications/[reference]/review/route.ts", "app/api/applicant/applications/[reference]/submit/route.ts",
  "app/api/applicant/applications/[reference]/withdraw/route.ts", "app/api/applicant/applications/[reference]/interviews/route.ts",
  "app/api/applicant/interviews/[reference]/select-slot/route.ts", "app/api/applicant/interviews/[reference]/request-reschedule/route.ts",
  "app/api/applicant/applications/[reference]/checks/route.ts", "app/api/applicant/checks/[reference]/consent/route.ts",
  "app/api/applicant/applications/[reference]/offer/route.ts", "app/api/applicant/offers/[reference]/accept/route.ts",
  "app/api/applicant/offers/[reference]/decline/route.ts", "app/api/applicant/privacy-notices/route.ts",
  "app/api/applicant/consents/route.ts", "app/api/applicant/data-requests/route.ts",
];
export const adminRoutes = [
  "requisitions/route.ts", "requisitions/[reference]/route.ts", "requisitions/[reference]/submit/route.ts", "requisitions/[reference]/approve/route.ts", "requisitions/[reference]/reject/route.ts", "requisitions/[reference]/cancel/route.ts",
  "openings/route.ts", "openings/[reference]/route.ts", "openings/[reference]/submit/route.ts", "openings/[reference]/approve/route.ts", "openings/[reference]/publish/route.ts", "openings/[reference]/pause/route.ts", "openings/[reference]/close/route.ts", "openings/[reference]/cancel/route.ts",
  "applications/route.ts", "applications/[reference]/route.ts", "applications/[reference]/assign-reviewer/route.ts", "applications/[reference]/request-information/route.ts", "applications/[reference]/progress/route.ts", "applications/[reference]/confirm-ineligibility/route.ts", "applications/[reference]/reject/route.ts",
  "interviews/route.ts", "interviews/[reference]/route.ts", "interviews/[reference]/schedule/route.ts", "interviews/[reference]/complete/route.ts",
  "checks/route.ts", "checks/[reference]/route.ts", "checks/[reference]/request/route.ts", "checks/[reference]/record-result/route.ts", "checks/[reference]/review/route.ts",
  "offers/route.ts", "offers/[reference]/route.ts", "offers/[reference]/submit/route.ts", "offers/[reference]/approve/route.ts", "offers/[reference]/issue/route.ts", "offers/[reference]/withdraw/route.ts",
  "handoffs/route.ts", "handoffs/[reference]/route.ts", "handoffs/[reference]/process/route.ts", "fraud/route.ts", "fraud/[reference]/route.ts",
  "reconciliation/route.ts", "reconciliation/[reference]/route.ts", "reconciliation/[reference]/rescan/route.ts", "reconciliation/[reference]/retry-opening-publication/route.ts", "reconciliation/[reference]/retry-application-freeze/route.ts", "reconciliation/[reference]/retry-check-composition/route.ts", "reconciliation/[reference]/retry-offer-issuance/route.ts", "reconciliation/[reference]/retry-onboarding-handoff/route.ts", "reconciliation/[reference]/retry-retention-action/route.ts", "privacy/route.ts", "retention/route.ts", "employment-equity/route.ts",
].map((route) => `app/api/admin/recruitment/${route}`);

export const recruitmentUiPages = [
  "app/(public)/careers/page.tsx", "app/(public)/careers/jobs/page.tsx", "app/(public)/careers/jobs/[reference]/page.tsx",
  "app/(public)/applicant/page.tsx", "app/(public)/applicant/profile/page.tsx", "app/(public)/applicant/applications/page.tsx", "app/(public)/applicant/applications/[reference]/page.tsx", "app/(public)/applicant/privacy/page.tsx", "app/(public)/applicant/data-requests/page.tsx",
  "app/(admin)/admin/recruitment/page.tsx", "app/(admin)/admin/recruitment/requisitions/page.tsx", "app/(admin)/admin/recruitment/openings/page.tsx", "app/(admin)/admin/recruitment/applications/page.tsx", "app/(admin)/admin/recruitment/interviews/page.tsx", "app/(admin)/admin/recruitment/checks/page.tsx", "app/(admin)/admin/recruitment/offers/page.tsx", "app/(admin)/admin/recruitment/handoffs/page.tsx", "app/(admin)/admin/recruitment/fraud/page.tsx", "app/(admin)/admin/recruitment/reconciliation/page.tsx", "app/(admin)/admin/recruitment/privacy/page.tsx", "app/(admin)/admin/recruitment/retention/page.tsx", "app/(admin)/admin/recruitment/employment-equity/page.tsx",
];

describe("Phase 26 route inventory", () => {
  it("contains every required public, applicant and admin API route as an executable handler", () => {
    for (const route of [...publicRoutes, ...applicantRoutes, ...adminRoutes]) {
      expect(fs.existsSync(path.join(root, route)), route).toBe(true);
      expect(source(route)).toMatch(/export async function (GET|POST|PATCH|PUT|DELETE)/);
    }
  });

  it("requires applicant authentication and admin permission enforcement on protected route inventories", () => {
    for (const route of applicantRoutes) expect(source(route), route).toContain("getCurrentUser");
    for (const route of adminRoutes) expect(source(route), route).toContain("requirePermission");
  });

  it("contains the public, applicant, and admin UI route inventories", () => {
    for (const page of recruitmentUiPages) expect(fs.existsSync(path.join(root, page)), page).toBe(true);
  });
});
