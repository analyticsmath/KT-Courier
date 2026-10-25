import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ProductionReadinessBoard } from "@/components/admin/ProductionReadinessBoard";
import type { Capability } from "@/lib/production-readiness/contracts";

const capabilities: Capability[] = [
  { key: "database", status: "READY", severity: "INFO", reasonCode: "CONFIGURED", safeSummary: "Database responds.", owner: "ENGINEERING" },
  { key: "cod_policy", status: "BLOCKED_EXTERNAL_INPUT", severity: "BLOCKER", reasonCode: "COD_APPROVED_SCOPE_MISSING", safeSummary: "100% COD needs approval.", owner: "FINANCE", evidence: { scopedPolicyCount: 0 } },
  { key: "cod_remittance", status: "BLOCKED_HUMAN_APPROVAL", severity: "BLOCKER", reasonCode: "COD_REMITTANCE_APPROVAL_REQUIRED", safeSummary: "Bank details need authorization.", owner: "FINANCE" },
  { key: "store_subscription_configuration", status: "DISABLED_BY_POLICY", severity: "WARNING", reasonCode: "COMMERCIAL_PROGRAM_INACTIVE_BY_POLICY", safeSummary: "Subscription is excluded.", owner: "CLIENT" },
];

describe("production readiness control board", () => {
  it("shows the actual gate counts and retains policy exclusions separate from blockers", () => {
    const html = renderToStaticMarkup(createElement(ProductionReadinessBoard, { capabilities }));
    expect(html).toContain("2 launch blockers");
    expect(html).toContain("1 verified ready");
    expect(html).toContain("1 excluded by policy");
    expect(html).toContain("100% COD needs approval.");
    expect(html).toContain("Finance &amp; settlement");
    expect(html).toContain("/admin/payment-policies");
    expect(html).toContain("/admin/cash-deposits");
    expect(html).toContain("COMMERCIAL_PROGRAM_INACTIVE_BY_POLICY");
  });
  it("never fabricates an all-clear when there are zero readiness records", () => {
    const html = renderToStaticMarkup(createElement(ProductionReadinessBoard, { capabilities: [] }));
    expect(html).toContain("No readiness evidence available");
    expect(html).not.toContain("Ready to launch");
  });
});
