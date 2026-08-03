import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync("app/(payments)/payments/payfast/return/page.tsx", "utf8");
describe("Payfast return page", () => {
  it("states that authoritative confirmation remains pending", () => expect(source).toContain("waiting for secure payment confirmation"));
  it("loads owned local status and bounded polling without mutation controls", () => { expect(source).toContain("getCustomerPaymentStatus"); expect(source).toContain("PaymentStatusPoller"); expect(source).not.toMatch(/createProviderCheckoutSession|update|cancel|refund|Payment successful/); });
});
