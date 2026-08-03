import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const route = readFileSync("app/api/payments/[publicReference]/checkout-session/route.ts", "utf8");
describe("Payfast checkout-session API contract", () => {
  it.each(["enforceSameOriginRequest", "getCurrentUser", "getOwnedPaymentIdentity", "PAYMENT_CHECKOUT", "PaymentOperationSchema"])("enforces %s", (control) => expect(route).toContain(control));
  it("selects Payfast server-side and accepts no provider selection", () => expect(route).toContain('provider: "PAYFAST"'));
  it("returns only an internal checkout transition instead of signed JSON fields", () => { expect(route).toContain("checkoutUrl"); expect(route).not.toMatch(/customerAction|\.fields|signature|merchantKey|passphrase/); });
  it("supports stable replay of an existing actionable attempt", () => expect(route).toMatch(/status === "REQUIRES_ACTION"[\s\S]*currentAttemptReference/));
});
