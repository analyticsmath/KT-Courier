import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sources = ["lib/services/payfast-itn-application.service.ts", "app/api/payments/payfast/itn/route.ts", "lib/payments/providers/payfast/payfast-source-hosts.ts", "lib/payments/providers/payfast/payfast-itn-validation-client.ts"].map((path) => readFileSync(path, "utf8")).join("\n");
describe("Phase 12 source boundaries", () => {
  it("contains no order/refund/withdrawal writer", () => expect(sources).not.toMatch(/\b(?:order|paymentRefund|withdrawalRequest)\.(?:create|update|upsert|delete)/));
  it("leaves marketplace and subscription work to the durable verified-payment processor", () => {
    const route = readFileSync("app/api/payments/payfast/itn/route.ts", "utf8");
    expect(route).not.toMatch(/onVerified(?:Marketplace|Subscription)PaymentSucceeded/);
    expect(readFileSync("lib/services/payfast-itn-application.service.ts", "utf8")).toContain("PAYMENT_SUCCEEDED_VERIFIED");
  });
  it("contains no copied IPv4 source allowlist or arbitrary validation URL", () => expect(sources).not.toMatch(/(?:\d{1,3}\.){3}\d{1,3}.*(?:\d{1,3}\.){3}\d{1,3}|PAYFAST_VALIDATION_URL/));
  it("pins South African Payfast endpoints and keeps route session-free", () => { expect(sources).toContain("payfast.co.za"); expect(sources).not.toMatch(/payfast\.com\.pk|getCurrentUser|requireAuth/); });
});
