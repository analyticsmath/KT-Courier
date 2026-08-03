import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync("app/(payments)/payments/payfast/cancel/page.tsx", "utf8");
describe("Payfast cancel page", () => {
  it("does not claim a definite failure or cancellation", () => { expect(source).toContain("No final payment result has been confirmed yet"); expect(source).not.toMatch(/Payment cancelled|Payment failed|status:\s*["']CANCELLED/); });
  it("offers safe navigation and performs no mutation", () => { expect(source).toContain("Back to payment details"); expect(source).not.toMatch(/createProviderCheckoutSession|updateMany|delete|refund/); });
});
