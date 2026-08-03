import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd(); const read = (file: string) => readFileSync(path.join(root, file), "utf8");
describe("subscription API contract", () => {
  it("has no public mark-paid or manual-entitlement endpoint", () => {
    expect(read("app/api/subscriptions/customer/prepare-payment/route.ts")).toContain("assertSubscriptionsProductionReady");
    expect(read("app/api/payments/payfast/itn/route.ts")).toContain("onVerifiedSubscriptionPaymentSucceededInProduction");
    expect(read("app/api/admin/subscription-contracts/route.ts")).not.toContain("mark-paid");
    expect(read("app/api/admin/subscription-plan-versions/[reference]/activate/route.ts")).toContain("SUBSCRIPTION_PLANS_ACTIVATE");
  });
});
