import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { projectProtectedNavigation } from "@/lib/protected-navigation/protected-navigation-registry";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";

function read(file: string) { return readFileSync(path.join(process.cwd(), file), "utf8"); }

describe("Dashboard operational design regression", () => {
  it("places Command centre before finance without leaking permission-restricted groups", () => {
    const all = projectProtectedNavigation("SUPER_ADMIN", new Set(Object.values(PERMISSIONS)));
    expect(all.groups[0]?.label).toBe("Command centre");
    const empty = projectProtectedNavigation("ADMIN", new Set());
    expect(empty.groups.some((group) => group.label === "Command centre")).toBe(false);
  });

  it("initializes sidebar groups collapsed but allows search to expand matches", () => {
    const navigation = read("components/protected-v2/navigation/ProtectedNavigation.tsx");
    expect(navigation).toContain("const [openGroups, setOpenGroups]");
    expect(navigation).toContain("Boolean(query.trim()) || openGroups.has(group.id)");
    expect(navigation).toContain("aria-expanded={isOpen}");
  });

  it("renders semantic status text without decorative rails or capsules", () => {
    const status = renderToStaticMarkup(React.createElement(ProtectedStatus, {label: "Awaiting confirmation", tone: "warning"}));
    expect(status).toContain("Awaiting confirmation");
    expect(status).not.toContain("eo-status__marker");
    const css = read("app/protected-operations.css");
    expect(css).toContain(".eo-status__marker { display: none; }");
    expect(css).toContain("background: transparent");
  });

  it("uses a focus-managed processor dialog rather than an overlapping transparent overlay", () => {
    const page = read("components/admin/ProcessorOperationsManager.tsx");
    expect(page).toContain("ProtectedDialog");
    expect(page).toContain('className="kt-processor-dialog"');
    expect(page).not.toContain("fixed inset-0 bg-black/50");
    expect(page).toContain('htmlFor="processor-execution-mode"');
    expect(page).toContain('htmlFor="processor-batch-size"');
  });

  it("keeps dispatch driver warnings collapsed and preserves the complete review list", () => {
    const readiness = read("components/admin/DispatchDriverReadiness.tsx");
    const dispatch = read("app/(admin)/admin/dispatch/page.tsx");
    expect(readiness).toContain('<details className="eo-readiness__details">');
    expect(readiness).toContain("blocked.map");
    expect(readiness).not.toContain('<details open=');
    expect(dispatch).toContain('className="eo-dispatch-metrics"');
    expect(dispatch).toContain('title="Ready for allocation"');
  });

  it("opens orders by their reference rather than a wrapping one-word action cell", () => {
    const page = read("app/(admin)/admin/orders/page.tsx");
    expect(page).toContain('className="eo-order-reference"');
    expect(page).not.toContain('id: "action", header: ""');
    expect(page).toContain("<ProtectedPagination");
  });

  it("loads illustrations through the owning CSS module", () => {
    expect(read("components/protected-v2/dashboard/DashboardIllustrationAsset.tsx")).toContain("OperationsSceneIllustration");
    expect(read("components/protected-v2/dashboard/DashboardCanvas.tsx")).not.toContain("dashboard-premium.css");
    expect(read("components/protected-v2/dashboard/dashboard.module.css")).toContain("--dash-brand:#1768ff");
    const illustration = read("components/protected-v2/illustrations/OperationsSceneIllustration.tsx");
    expect(illustration).toContain("<svg");
    expect(illustration).toContain("scene-blue");
  });
});
