import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
const route = (name: string) => read(`app/api/admin/subscription-contracts/[reference]/${name}/route.ts`);

describe("subscription administrative recovery source audit", () => {
  it("gates every retry route with its exact reconciliation permission and canonical recovery operation", () => {
    const matrix = [
      ["retry-activation", "SUBSCRIPTION_BILLING_RECONCILE"],
      ["retry-settlement", "SUBSCRIPTION_BILLING_RECONCILE"],
      ["retry-renewal", "SUBSCRIPTION_BILLING_RECONCILE"],
      ["retry-provider-sync", "SUBSCRIPTION_CONTRACTS_RECONCILE"],
      ["retry-cancellation", "SUBSCRIPTION_CONTRACTS_RECONCILE"],
      ["retry-refund", "SUBSCRIPTION_BILLING_RECONCILE"],
      ["retry-entitlement-reconciliation", "SUBSCRIPTION_ENTITLEMENTS_RECONCILE"],
      ["rescan", "SUBSCRIPTION_CONTRACTS_RECONCILE"],
    ] as const;
    for (const [name, permission] of matrix) {
      const source = route(name);
      expect(source).toContain(`PERMISSIONS.${permission}`);
      expect(source).toContain(`"${name}"`);
      expect(source).toContain("subscriptionRecoveryRoute");
    }
  });

  it("requires a strict operation ID, origin/rate checks, explicit DENY, and no manual financial controls", () => {
    const admin = read("lib/subscriptions/admin-route.ts");
    expect(admin).toContain("enforceSubscriptionMutation");
    expect(admin).toContain('effect: "DENY"');
    expect(admin).toContain("requiredSubscriptionOperationId");
    expect(admin).toContain("runSubscriptionAdministrativeRecoveryInProduction");
    expect(admin).not.toMatch(/markPaid|manual.*grant|ledgerJournal\.create|providerToken/i);
  });
});
