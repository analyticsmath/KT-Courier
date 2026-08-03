import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const route = readFileSync("app/api/payments/[publicReference]/route.ts", "utf8");
const service = readFileSync("lib/services/payment-customer-query.service.ts", "utf8");
describe("customer payment status API contract", () => {
  it.each(["getCurrentUser", "ALLOWED_ROLES", "PAYMENT_STATUS", "getCustomerPaymentStatus"])("enforces %s", (control) => expect(route).toContain(control));
  it("scopes the read to payer and public reference", () => expect(service).toContain("where: { publicReference, userId: payerId }"));
  it("omits internal and secret fields", () => expect(service).not.toMatch(/requestHash|creationRequestHash|requestSnapshot|resultSnapshot|merchantKey|passphrase|signature/));
});
