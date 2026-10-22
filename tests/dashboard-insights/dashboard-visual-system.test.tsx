import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StaticBarChart } from "@/components/protected-v2/dashboard/charts/StaticBarChart";
import { StaticSegmentedBar } from "@/components/protected-v2/dashboard/charts/StaticSegmentedBar";

const file = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

describe("KT protected dashboard visual system", () => {
  it("isolates the cool-white refinement to protected routes", () => {
    const css = file("app/globals.css");
    const start = css.indexOf("KT DASHBOARD REFINEMENT V1");
    expect(start).toBeGreaterThan(0);
    const refinement = css.slice(start);
    expect(refinement).toContain('[data-kt-protected-system="editorial-operations-v1"]');
    expect(refinement).not.toContain('[data-kt-visual-system="editorial-freight-v1"]');
    expect(refinement).toContain("--eo-canvas: #F5F7FB");
    expect(refinement).toContain("animation: none !important");
    expect(refinement).toContain("transition: none !important");
  });

  it("retains compact mobile controls and resilient table overflow", () => {
    const global = file("app/globals.css");
    const dashboard = file("components/protected-v2/dashboard/dashboard.module.css");
    expect(global).toContain("overscroll-behavior-inline: contain");
    expect(global).toContain("overflow-x: hidden");
    expect(dashboard).toContain(".headerActions > * { flex: 0 1 auto; }");
    expect(dashboard).toContain("@media (min-width: 390px) and (max-width: 639px)");
    expect(dashboard).toContain(".coverageList");
  });

  it("shows zero activity as a zero-height bar rather than a visible false count", () => {
    const html = renderToStaticMarkup(
      <StaticBarChart
        label="Courier orders"
        buckets={[
          { start: "2026-10-01T00:00:00Z", end: "2026-10-02T00:00:00Z", label: "Thu", value: 0 },
          { start: "2026-10-02T00:00:00Z", end: "2026-10-03T00:00:00Z", label: "Fri", value: 2 },
        ]}
      />,
    );
    expect(html).toContain('height:0%');
    expect(html).toContain('height:100%');
    expect(html).toContain("Courier orders");
  });
  it("includes contextual segmented values in chart's accessible summary", () => {
    const html = renderToStaticMarkup(
      <StaticSegmentedBar
        label="Promoter wallet"
        segments={[
          { key: "available", label: "Available", value: 12500, displayValue: "ZAR 125.00", color: "#167B59" },
          { key: "pending", label: "Pending", value: 2500, displayValue: "ZAR 25.00", color: "#A36620" },
        ]}
      />,
    );
    expect(html).toContain("Promoter wallet");
    expect(html).toContain("Available: ZAR 125.00");
    expect(html).toContain("Pending: ZAR 25.00");
  });

  it("retains semantic operational tables for three admin queues", () => {
    const admin = file("components/protected-v2/admin/AdminCommandCentre.tsx");
    expect(admin.match(/<table className=\{styles.queueTable\}>/g)).toHaveLength(3);
    expect(admin).toContain("<th scope=\"col\">");
    const desk = file("lib/dashboard-insights/admin-desk.ts");
    expect(desk).toContain("b.occurredAt.getTime() - a.occurredAt.getTime()");
  });

  it("keeps dark-card controls visually distinct from their surface and omits decor in operational states", () => {
    const css = file("components/protected-v2/dashboard/dashboard.module.css");
    expect(css).toContain(".toneDark .btnDark");
    expect(css).toContain("background: #2C3954");
    for (const sourcePath of [
      "components/protected-v2/admin/AdminCommandCentre.tsx",
      "components/protected-v2/driver/DriverHomePage.tsx",
      "components/protected-v2/store/StoreOverviewPage.tsx",
      "components/protected-v2/promoter/PromoterDashboardOverview.tsx",
    ]) {
      expect(file(sourcePath)).not.toContain("DashboardIllustrationAsset");
    }
  });

});
