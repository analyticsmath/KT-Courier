import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ProductionReadinessBoard } from "@/components/admin/ProductionReadinessBoard";
import type { Capability } from "@/lib/production-readiness/contracts";

function adminPageExists(href: string): boolean {
  const segments = href.replace(/^\//, "").split("/");
  return existsSync(path.join(process.cwd(), "app", "(admin)", ...segments, "page.tsx"));
}

const capabilities: Capability[] = [
  { key: "database", status: "READY", severity: "INFO", reasonCode: "CONFIGURED", safeSummary: "Database responds.", owner: "ENGINEERING" },
  { key: "cod_policy", status: "BLOCKED_EXTERNAL_INPUT", severity: "BLOCKER", reasonCode: "COD_APPROVED_SCOPE_MISSING", safeSummary: "The approved 50/50 COD policy needs approval.", owner: "FINANCE", evidence: { scopedPolicyCount: 0 } },
  { key: "cod_remittance", status: "BLOCKED_HUMAN_APPROVAL", severity: "BLOCKER", reasonCode: "COD_REMITTANCE_APPROVAL_REQUIRED", safeSummary: "Bank details need authorization.", owner: "FINANCE" },
  { key: "store_subscription_configuration", status: "DISABLED_BY_POLICY", severity: "WARNING", reasonCode: "COMMERCIAL_PROGRAM_INACTIVE_BY_POLICY", safeSummary: "Subscription is excluded.", owner: "CLIENT" },
];

describe("production readiness control board", () => {
  it("shows the actual gate counts and retains policy exclusions separate from blockers", () => {
    const html = renderToStaticMarkup(createElement(ProductionReadinessBoard, { capabilities }));
    expect(html).toContain("2 launch blockers");
    expect(html).toContain("1 verified ready");
    expect(html).toContain("1 excluded by policy");
    expect(html).toContain("The approved 50/50 COD policy needs approval.");
    expect(html).toContain("Finance &amp; settlement");
    expect(html).toContain("/admin/payment-policies");
    expect(html).toContain("/admin/cash-deposits");
    expect(html).toContain("COMMERCIAL_PROGRAM_INACTIVE_BY_POLICY");
  });

  it("links Provider diagnostics to the existing /admin/payment-providers page and resolves every readiness link", () => {
    const blockedCapabilities: Capability[] = [
      { key: "payment_provider", status: "BLOCKED_CONFIGURATION", severity: "BLOCKER", reasonCode: "CONFIGURATION_MISSING", safeSummary: "Paystack configuration required.", owner: "FINANCE" },
      { key: "cod_policy", status: "BLOCKED_EXTERNAL_INPUT", severity: "BLOCKER", reasonCode: "COD_APPROVED_SCOPE_MISSING", safeSummary: "COD policy missing.", owner: "FINANCE" },
      { key: "cod_remittance", status: "BLOCKED_HUMAN_APPROVAL", severity: "BLOCKER", reasonCode: "COD_REMITTANCE_APPROVAL_REQUIRED", safeSummary: "Bank details required.", owner: "FINANCE" },
      { key: "operational_coverage", status: "BLOCKED_CONFIGURATION", severity: "BLOCKER", reasonCode: "COVERAGE_MISSING", safeSummary: "Coverage required.", owner: "OPERATIONS" },
      { key: "courier_services", status: "BLOCKED_CONFIGURATION", severity: "BLOCKER", reasonCode: "PRICING_MISSING", safeSummary: "Pricing required.", owner: "OPERATIONS" },
      { key: "notification_routes", status: "BLOCKED_CONFIGURATION", severity: "BLOCKER", reasonCode: "ROUTES_MISSING", safeSummary: "Notification routes required.", owner: "ENGINEERING" },
      { key: "notification_templates", status: "BLOCKED_CONFIGURATION", severity: "BLOCKER", reasonCode: "TEMPLATES_MISSING", safeSummary: "Notification templates required.", owner: "ENGINEERING" },
    ];
    const html = renderToStaticMarkup(createElement(ProductionReadinessBoard, { capabilities: blockedCapabilities }));

    expect(html).toContain('href="/admin/payment-providers"');
    expect(html).toContain("Provider diagnostics");
    expect(html).not.toContain("/admin/integrations");
    expect(adminPageExists("/admin/integrations")).toBe(false);
    expect(adminPageExists("/admin/payment-providers")).toBe(true);

    const hrefs = [...html.matchAll(/href="(\/admin\/[^"]+)"/g)].map((match) => match[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(7);
    for (const href of hrefs) {
      expect(adminPageExists(href), `Missing App Router page for readiness link ${href}`).toBe(true);
    }
  });

  it("never fabricates an all-clear when there are zero readiness records", () => {
    const html = renderToStaticMarkup(createElement(ProductionReadinessBoard, { capabilities: [] }));
    expect(html).toContain("No readiness evidence available");
    expect(html).not.toContain("Ready to launch");
  });
});
