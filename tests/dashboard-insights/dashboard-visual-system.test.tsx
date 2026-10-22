import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StaticBarChart } from "@/components/protected-v2/dashboard/charts/StaticBarChart";

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
});
