import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const page = readFileSync("app/(payments)/orders/[orderReference]/payment/page.tsx", "utf8");
const client = readFileSync("components/payments/PaymentCheckoutClient.tsx", "utf8");
describe("Payfast customer payment page", () => {
  it.each(["Order reference", "Amount", "Payment status", "Provider", "Pay with Payfast"])("contains %s", (label) => expect(`${page}\n${client}`).toContain(label));
  it("shows sandbox and production lock states", () => { expect(client).toContain("Payfast Sandbox — no real money will be transferred"); expect(client).toContain("production checkout is unavailable"); });
  it("has no amount input or provider selector", () => expect(`${page}\n${client}`).not.toMatch(/<input[^>]+(?:amount|currency)|<select|providerId/));
});
