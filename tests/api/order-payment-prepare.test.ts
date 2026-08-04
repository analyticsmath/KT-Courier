import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const route = readFileSync("app/api/orders/[id]/payment/route.ts", "utf8");
const validation = readFileSync("lib/validation/payments.ts", "utf8");
describe("order payment preparation API contract", () => {
  it.each(["enforceSameOriginRequest", "getCurrentUser", "ALLOWED_ROLES", "PAYMENT_PREPARE", "PaymentOperationSchema"])("enforces %s", (control) => expect(route).toContain(control));
  it("maps only operationId plus the path order identity into the internal command", () => { expect(validation).toContain("PaymentOperationSchema = z.object({ operationId }).strict()"); expect(route).toContain("idempotencyKey: parsed.data.operationId"); });
  it("does not accept client amount, currency, provider, payer, or callback input", () => expect(validation.match(/PaymentOperationSchema[^\n]+/u)?.[0]).not.toMatch(/amount|currency|provider|payer|returnUrl|cancelUrl/));
  it("returns a public safe payment projection", () => expect(route).toMatch(/publicReference:[\s\S]*orderReference:[\s\S]*amount:[\s\S]*currency:[\s\S]*status:/));
});
