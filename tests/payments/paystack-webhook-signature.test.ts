import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPaystackSignature, verifyPaystackWebhookSecretSignature } from "@/lib/payments/providers/paystack/paystack-signature";

const secret = "whsec_kt_couriers_test_secret_long_enough";
const previous = "whsec_kt_couriers_previous_secret_long_enough";
const now = 1794229200;
const body = '{"event":"charge.success","data":{"reference":"PAY-123","amount":25000}}';
function signed(payload: string, key: string, at = now, keyId = "whk_current1") {
  const digest = createHmac("sha512", key).update(String(at) + "." + payload).digest("hex");
  return "t=" + at + ",v1=" + keyId + ":" + digest;
}
describe("Paystack timestamped webhook signatures", () => {
  it("validates the exact body with the matching secret", () => {
    expect(verifyPaystackWebhookSecretSignature(body, signed(body, secret), [secret], now)).toBe(true);
    expect(verifyPaystackWebhookSecretSignature(body + " ", signed(body, secret), [secret], now)).toBe(false);
    expect(verifyPaystackWebhookSecretSignature(body, signed(body, previous), [secret], now)).toBe(false);
  });
  it("accepts a genuine second v1 signature during a secret rotation", () => {
    const oldSignature = signed(body, previous).split(",")[1];
    const mixed = signed(body, "whsec_wrong") + "," + oldSignature + ",v0=ignored";
    expect(verifyPaystackWebhookSecretSignature(body, mixed, [secret, previous], now)).toBe(true);
    expect(verifyPaystackWebhookSecretSignature(body, mixed, [secret], now)).toBe(false);
  });
  it("rejects old, future, duplicate or malformed timestamps", () => {
    expect(verifyPaystackWebhookSecretSignature(body, signed(body, secret, now - 300), [secret], now)).toBe(true);
    expect(verifyPaystackWebhookSecretSignature(body, signed(body, secret, now - 301), [secret], now)).toBe(false);
    expect(verifyPaystackWebhookSecretSignature(body, signed(body, secret, now + 301), [secret], now)).toBe(false);
    expect(verifyPaystackWebhookSecretSignature(body, signed(body, secret) + ",t=" + now, [secret], now)).toBe(false);
    expect(verifyPaystackWebhookSecretSignature(body, "t=abc,v1=whk_test:" + "0".repeat(128), [secret], now)).toBe(false);
    expect(verifyPaystackWebhookSecretSignature(body, null, [secret], now)).toBe(false);
  });
  it("never confuses a Paystack API secret with a webhook signing secret", () => {
    expect(verifyPaystackWebhookSecretSignature(body, signed(body, secret), ["sk_live_abc"], now)).toBe(false);
    const legacy = createHmac("sha512", "sk_test_abc").update(body).digest("hex");
    expect(verifyPaystackSignature(body, legacy, "sk_test_abc")).toBe(true);
  });
});
