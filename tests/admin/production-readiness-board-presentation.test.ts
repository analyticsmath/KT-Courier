import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductionReadinessBoard } from "@/components/admin/ProductionReadinessBoard";
import type { CapabilityMatrixEntry } from "@/lib/production-readiness/capability-matrix.service";

describe("ProductionReadinessBoard capability matrix scope presentation", () => {
  it("renders policy-excluded capabilities as EXCLUDED_BY_POLICY instead of BLOCKED while preserving activation locks and in-scope blockers", () => {
    const capabilityMatrix: CapabilityMatrixEntry[] = [
      {
        key: "PAYSTACK_CARD",
        label: "Paystack card payments",
        sourceImplemented: true,
        isolatedTestPassSha: "29480f652095ab6ce6d3ba5094dcffb7a8f30810",
        runtimeConfigured: true,
        externalEntitlementApproved: true,
        adminPolicyEffective: true,
        schedulerRegisteredAndHealthy: true,
        eligibleForLiveUse: true,
        lastBlockerCode: null,
      },
      {
        key: "STORE_CHECKOUT",
        label: "Marketplace store checkout",
        sourceImplemented: true,
        isolatedTestPassSha: null,
        runtimeConfigured: true,
        externalEntitlementApproved: true,
        adminPolicyEffective: false,
        schedulerRegisteredAndHealthy: true,
        eligibleForLiveUse: false,
        lastBlockerCode: "NO_ACTIVE_STORE_ORDER_OPERATIONAL_POLICY",
      },
      {
        key: "SUBSCRIPTIONS",
        label: "Vendor subscription plans and recurring billing",
        sourceImplemented: true,
        isolatedTestPassSha: null,
        runtimeConfigured: false,
        externalEntitlementApproved: false,
        adminPolicyEffective: false,
        schedulerRegisteredAndHealthy: null,
        eligibleForLiveUse: false,
        lastBlockerCode: "DISABLED_BY_POLICY",
      },
      {
        key: "PROMOTERS",
        label: "Promoter referral program",
        sourceImplemented: true,
        isolatedTestPassSha: null,
        runtimeConfigured: false,
        externalEntitlementApproved: false,
        adminPolicyEffective: false,
        schedulerRegisteredAndHealthy: null,
        eligibleForLiveUse: false,
        lastBlockerCode: "DISABLED_BY_POLICY",
      },
      {
        key: "ADVERTISING",
        label: "Paid marketplace advertising campaigns",
        sourceImplemented: true,
        isolatedTestPassSha: null,
        runtimeConfigured: false,
        externalEntitlementApproved: false,
        adminPolicyEffective: false,
        schedulerRegisteredAndHealthy: null,
        eligibleForLiveUse: false,
        lastBlockerCode: "DISABLED_BY_POLICY",
      },
    ];

    const html = renderToStaticMarkup(
      createElement(ProductionReadinessBoard, {
        capabilities: [],
        capabilityMatrix,
      }),
    );

    expect(html).toContain("In-scope eligible: 1 / 2");
    expect(html).toContain("In-scope blockers: 1");
    expect(html).toContain("Excluded by policy (locked): 3");
    expect(html).toContain("ELIGIBLE");
    expect(html).toContain("EXCLUDED_BY_POLICY");
    expect(html).toContain("DISABLED_BY_POLICY (excluded from v1 scope; locked)");
    expect(html).toContain("NO_ACTIVE_STORE_ORDER_OPERATIONAL_POLICY");
  });
});
