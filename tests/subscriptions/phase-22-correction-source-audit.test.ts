import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("phase 22 correction source audit", () => {
  it("keeps recurring REST separate from custom checkout and preserves compatibility renames", () => {
    const recurring = read("lib/subscriptions/providers/payfast-recurring-adapter.ts");
    expect(recurring).toContain("https://api.payfast.co.za");
    expect(recurring).not.toContain("PayfastAdapter");
    expect(read("prisma/migrations/20260717140000_phase22_subscriptions/migration.sql")).toMatch(/RENAME TO "LegacySubscriptionPlan"[\s\S]*RENAME TO "LegacyStoreSubscription"[\s\S]*RENAME TO "LegacySubscriptionInvoice"/);
  });

  it("requires settlement before paid grants and records deferred/revenue evidence", () => {
    const hook = read("lib/subscriptions/subscription-payment-success-hook.service.ts");
    expect(hook.indexOf("subscriptionInvoiceSettlement")).toBeLessThan(hook.indexOf("subscriptionEntitlementGrant.upsert"));
    expect(read("lib/subscriptions/subscription-ledger-policy.ts")).toContain("SUBSCRIPTION_DEFERRED_REVENUE");
    expect(read("lib/subscriptions/subscription-revenue-recognition.service.ts")).toContain("cumulativeAmount");
  });

  it("records the truthful completion audit and architect correction report", () => {
    expect(read("docs/phase-22-research-and-implementation-map.md")).toContain("non-destructive\ncompatibility migration");
    const report = read("docs/phase-22-architect-correction-report.md");
    expect(report).toContain("CORRECTION COMPLETE — DEEP VALIDATION DEFERRED TO PHASE 26.5");
    expect(report).toContain("READY FOR ARCHITECT IMPLEMENTATION REVIEW");
  });
});
