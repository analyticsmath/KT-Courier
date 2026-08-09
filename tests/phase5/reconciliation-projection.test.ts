import { describe, expect, it } from "vitest";
import { domainAdapters } from "@/lib/reconciliation/adapters/domain-adapters";
import { executeUnifiedBulkRecovery, executeUnifiedRecoveryCommand, listUnifiedReconciliationCases } from "@/lib/reconciliation/service";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

describe("Phase 5: Unified Cross-Domain Reconciliation Projection", () => {
  it("includes all 14 required domains in domain adapters registry", () => {
    const requiredDomains = [
      "payments",
      "marketplace_checkout",
      "store_orders",
      "refunds",
      "withdrawals",
      "store_earnings",
      "driver_earnings",
      "commissions",
      "subscriptions",
      "promotions",
      "advertising",
      "notifications",
      "developer_api",
      "reporting",
    ];

    for (const domain of requiredDomains) {
      expect(domainAdapters[domain as keyof typeof domainAdapters]).toBeDefined();
      expect(domainAdapters[domain as keyof typeof domainAdapters].domain).toBe(domain);
      expect(domainAdapters[domain as keyof typeof domainAdapters].requiredViewPermission).toBeDefined();
    }
  });

  it("filters unauthorized domains for an actor with limited permissions", async () => {
    // Actor with only payments view permission
    const limitedPermissions = new Set([PERMISSIONS.PAYMENT_RECONCILIATION_READ]);
    const result = await listUnifiedReconciliationCases(limitedPermissions, { limit: 10 });

    expect(result.cases.every((c) => c.domain === "payments")).toBe(true);
  });

  it("returns empty case list when actor has zero reconciliation permissions", async () => {
    const result = await listUnifiedReconciliationCases(new Set(), { limit: 10 });
    expect(result.cases).toEqual([]);
    expect(result.totalReturned).toBe(0);
  });

  it("enforces recovery permission check before executing recovery command", async () => {
    const actorUserId = "usr-test-123";
    const limitedPermissions = new Set([PERMISSIONS.PAYMENT_RECONCILIATION_READ]);

    await expect(
      executeUnifiedRecoveryCommand(actorUserId, limitedPermissions, {
        domain: "refunds",
        reference: "REF-TEST-001",
        actionKey: "RETRY_REFUND",
        actorUserId,
        operationId: "RECOP-123",
        reasonCode: "TEST_REASON",
      }),
    ).rejects.toThrow(/Unauthorized to execute recovery action/);
  });

  it("enforces maximum batch limit of 50 items for bulk recovery", async () => {
    const references = Array.from({ length: 51 }, (_, i) => `REF-${i}`);
    const permissions = new Set([PERMISSIONS.REFUNDS_PROCESS]);

    await expect(
      executeUnifiedBulkRecovery("usr-test", permissions, "refunds", "REFUND_EXECUTION_FAILED", "RETRY_REFUND", references, "BULK-OP"),
    ).rejects.toThrow(/maximum permitted batch size of 50/);
  });
});
