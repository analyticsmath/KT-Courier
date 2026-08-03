import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (relative: string) => readFileSync(join(root, relative), "utf8");

function collectAdminPageFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectAdminPageFiles(full));
    } else if (entry === "page.tsx") {
      files.push(full);
    }
  }
  return files;
}

const r20Routes = [
  "/admin/deliveries", "/admin/dispatch", "/admin/live-map", "/admin/drivers",
  "/admin/fleet", "/admin/stores", "/admin/customers", "/admin/analytics",
  "/admin/revenue", "/admin/settlements", "/admin/pricing", "/admin/coupons",
  "/admin/audit-logs", "/admin/roles", "/admin/system-health", "/admin/integrations", "/admin/support"
];

function r21Pages(): { route: string; file: string }[] {
  const matrix = source("docs/frontend/r21-admin-route-matrix.md");
  const matches = [...matrix.matchAll(/^\| `(\/admin[^|]*)` \|/gm)];
  return matches
    .map((match) => match[1])
    .filter((route) => !r20Routes.includes(route))
    .map((route) => {
      const suffix = route.replace(/^\/admin/, "");
      const file = join(root, "app", "(admin)", "admin", suffix || ".", "page.tsx");
      return { route, file };
    });
}

describe("R21 administration operations II", () => {
  it("documents financial reconciliation operational contract", () => {
    const report = source("docs/financial-reconciliation-operational-report.md");
    expect(report).toContain("Financial reconciliation");
  });

  it("keeps every live administration route under the protected-v2 administration boundary", () => {
    const pages = collectAdminPageFiles(join(root, "app", "(admin)", "admin"));
    expect(pages.length).toBeGreaterThanOrEqual(136);
    expect(pages.every(existsSync)).toBe(true);
    const layout = source("app/(admin)/admin/layout.tsx");
    expect(layout).toContain("AdministrationWorkspace");
    expect(layout).toContain("<AdministrationWorkspace>{children}</AdministrationWorkspace>");
  });

  it("documents all 105 concrete R21 routes in the exact route-body audit", () => {
    const routes = r21Pages().map(({ route }) => route);
    const matrix = source("docs/frontend/r21-admin-route-matrix.md");
    expect(routes.length).toBeGreaterThanOrEqual(105);
    for (const route of routes) expect(matrix).toContain(`| \`${route}\` |`);
  });

  it("closes the page-body evidence gap without a legacy or raw route body", () => {
    const pages = r21Pages();
    const code = pages.map(({ file }) => readFileSync(file, "utf8")).join("\n");
    expect(pages.length).toBeGreaterThanOrEqual(105);
    expect(pages.every(({ file }) => readFileSync(file, "utf8").includes("@/components/protected-v2/"))).toBe(true);
    expect(code).not.toMatch(/@\/components\/ui\/(PageHeader|Card)|<PageHeader\b|<Card\b/);
    expect(code).not.toMatch(/PromoterSurface|AdminNotificationSurface|NotificationCentre|DeveloperPortalSurface/);
    expect(code).not.toMatch(/['"]use client['"]|JSON\.stringify|<pre\b/);
  });

  it("records a complete closure classification and keeps R20 out of the R21 audit", () => {
    const matrix = source("docs/frontend/r21-admin-route-matrix.md");
    const audit = matrix.slice(matrix.indexOf("<!-- R21 ROUTE BODY AUDIT START -->"), matrix.indexOf("<!-- R21 ROUTE BODY AUDIT END -->"));
    expect((audit.match(/^\| `\/admin[^|]*` \|/gm) || []).length).toBeGreaterThanOrEqual(105);
    expect(audit).toContain("`PROTECTED_V2_DIRECT`: 12");
    expect(audit).toContain("`PROTECTED_V2_COMPOSED`: 64");
    expect(audit).toContain("`TRUTHFUL_LOCKED_STATE`: 27");
    expect(audit).toContain("`TRUTHFUL_UNAVAILABLE_STATE`: 2");
    expect(audit).toContain("`LEGACY_BODY_IN_PROTECTED_SHELL`: 0");
    expect(audit).toContain("`RAW_MARKUP_IN_PROTECTED_SHELL`: 0");
    expect(audit).toContain("`UNKNOWN`: 0");
    for (const route of r20Routes) expect(audit).not.toContain(`| \`${route}\` |`);
  });

  it("keeps closure surfaces truthful and avoids fabricated administrative data or client authority", () => {
    const code = r21Pages().map(({ file }) => readFileSync(file, "utf8")).join("\n");
    expect(code).not.toMatch(/activeRequisitions|publishedOpenings|pendingApplications|scheduledInterviews|setStats|parseFloat|Math\./);
  });
});
