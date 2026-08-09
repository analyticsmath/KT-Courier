import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
describe("phase 22 final lifecycle source audit", () => {
  it("wires renewal ITN, cancellation, synchronization, refund and entitlement services concretely", () => {
    expect(read("lib/payments/verified-payment-event-processor.service.ts")).toContain("onVerifiedSubscriptionPaymentSucceededInProduction");
    expect(read("lib/subscriptions/subscription-payment-success-hook.service.ts")).toContain("resolveSubscriptionProviderEvent");
    expect(read("lib/subscriptions/subscription-cancellation.service.ts")).toContain("cancelRecurringAuthority");
    expect(read("lib/subscriptions/subscription-provider-synchronization.service.ts")).toContain("synchronizeRecurringAuthority");
    expect(read("lib/subscriptions/subscription-refund.service.ts")).toContain("createRefundRequest");
    expect(read("lib/subscriptions/subscription-entitlement-refund.service.ts")).toContain("Usage rows are append-only");
  });
  it("keeps admin recovery and processor shells away from manual financial controls", () => {
    const admin = read("lib/subscriptions/admin-route.ts");
    expect(admin).toContain("subscriptionRecoveryRoute");
    expect(admin).toContain('effect: "DENY"');
    const scripts = read("scripts/subscription-script-support.mjs");
    expect(scripts).toContain("subscription-processor.ts");
    expect(scripts).not.toContain("ledgerAccount.update");
    expect(scripts).not.toContain("markPaid");
  });

  it("keeps production recovery behind real locks and persists only safe retry evidence", () => {
    const recovery = read("lib/subscriptions/subscription-administrative-recovery.service.ts");
    const processor = read("scripts/subscription-processor.ts");
    const lifecycle = read("lib/subscriptions/prisma-subscription-lifecycle.repository.ts");
    expect(recovery).toContain("subscriptionOperationReceipt.upsert");
    expect(recovery).not.toContain("testApproval: { approved: true }");
    expect(processor).not.toContain("testApproval: { approved: true }");
    expect(lifecycle).toContain('SELECT "id" FROM "SubscriptionPaymentAuthority" WHERE "publicReference" = ${input.authorityReference} FOR UPDATE');
    expect(lifecycle).toContain('SELECT "id" FROM "SubscriptionContract" WHERE "id" = ${authority.contract.id} FOR UPDATE');
  });
});
