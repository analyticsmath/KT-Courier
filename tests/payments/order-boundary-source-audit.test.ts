import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sources = ["lib/services/payment-subject.service.ts", "lib/services/payment-preparation.service.ts", "lib/services/payment-provider-session.service.ts"].map((file) => readFileSync(file, "utf8")).join("\n");
describe("payment-to-order source boundary", () => {
  it("reads orders but never mutates order, pricing, dispatch, or driver state", () => {
    expect(sources).toMatch(/order\.findUnique/);
    expect(sources).not.toMatch(/(?:order|pricingQuote|orderAssignment|driverProfile)\.(?:create|update|updateMany|delete|upsert)/);
  });
  it("contains no PayFast implementation, webhook processor, or refund writer", () => expect(sources).not.toMatch(/payfast.*signature|paymentWebhookEvent\.(?:create|update)|paymentRefund\.(?:create|update)/i));
});

